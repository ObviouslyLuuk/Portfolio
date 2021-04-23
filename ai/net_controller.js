import { Network } from "./neural_net.js"
import { get_max_value_index } from "./helper.js"

// credit: https://stackoverflow.com/questions/49338193/how-to-use-code-from-script-with-type-module
window.NetController = class NetController {
    constructor(io_shape=[{x: [0,0], y: [0,0]}],
                layers=[{type: "Dense", size:16}, {type: "Dense", size:16}],
                eta=1,
                gamma=.99,
                batch_size=32,
                max_memory=50000,
                epsilon=1,
                epsilon_end=.1,
                epsilon_decay=.0001,
                double_dqn=true,
                target_update_time=1000) {
                    
        this.input_length = io_shape[0].x.length
        this.output_length = io_shape[0].y.length
        this.policy_network = new Network(io_shape, layers)
        this.target_network = new Network(io_shape, layers)
        this.update_target_network()

        this.eta = eta
        this.eta_begin = eta
        this.gamma = gamma

        this.batch_size = batch_size

        this.max_memory = max_memory
        this.replay_memory = []
        this.current_memory = {}
        
        this.epsilon = epsilon
        this.epsilon_begin = epsilon
        this.epsilon_end = epsilon_end
        this.epsilon_decay = epsilon_decay

        this.double_dqn = double_dqn
        this.target_update_time = target_update_time
        this.target_update_timer = 0

        this.q_log = {sum:0,length:0}

        this.total_parameters = this.get_total_parameters()
        this.total_neurons = this.get_total_neurons()
    }

    update_target_network() {
        if (!this.double_dqn) return

        // Only once every so often
        if (this.target_update_timer == 0) {
            for (let l = 1; l < this.target_network.layers.length; l++) {
                let layer = this.target_network.layers[l]
                layer.weights = [...this.policy_network.layers[l].weights]
                layer.biases = [...this.policy_network.layers[l].biases]
            }
            this.target_update_timer = this.target_update_time
        } else {
            this.target_update_timer--
        }
    }

    get_policy(input) {
        this.current_memory.s0 = input

        let layer_count = this.policy_network.layers.length
        if (this.epsilon >= Math.random()) {
            this.current_memory.a = Math.floor( Math.random()*this.output_length )
        } else {
            let output_activations = this.policy_network.layers[layer_count - 1].feedforward(input, null).output
            this.current_memory.a = get_max_value_index( output_activations )
        }
        return this.current_memory.a
    }

    get_qs(input) {
        let layer_count = this.policy_network.layers.length

        let output_activations = this.policy_network.layers[layer_count - 1].feedforward(input, null).output

        return output_activations
    }

    store_in_memory(reward, next_state, done) {
        // if (reward == 0) return // Only save experiences where the reward changed

        let memory_length = this.replay_memory.length
        if (memory_length >= this.max_memory) {
            // this.replay_memory.splice( Math.floor(Math.random()*memory_length) ) // Remove random index
            this.replay_memory.splice(0) // Remove first index
        }
        let experience = {
            s0: this.current_memory.s0,
            a: this.current_memory.a,
            r: reward,
            s1: next_state,
            done: done,
        }
        this.replay_memory.push(experience)
    }

    select_batch_from_memory() {
        // Select random batch
        let experiences = [...this.replay_memory]
        let batch = []
        for (let i = 0; i < this.batch_size; i++) {
            if (experiences.length < 1) break
            let experience = experiences[ Math.floor(Math.random()*experiences.length) ]
            batch.push( experience )
        }
        return batch
    }

    SGD() {
        if (isNaN(this.eta) || this.eta == 0) return

        let batch = this.select_batch_from_memory()
        if (batch.length < 1) return

        let layer_count = this.policy_network.layers.length
        for (let experience of batch) {

            let expectation
            if (experience.done) {
                expectation = experience.r
            } else {
                let output_activations
                if (this.double_dqn) {
                    // Get max q value from feeding s1 of the experience into the target network
                    output_activations = this.target_network.layers[layer_count - 1].feedforward(experience.s1, null).output
                } else {
                    // Get max q value from feeding s1 of the experience into the policy network
                    output_activations = this.policy_network.layers[layer_count - 1].feedforward(experience.s1, null).output
                }

                let q_value = Math.max(...output_activations)

                // Save q values for logging the average
                this.q_log.sum += Math.abs(q_value)
                this.q_log.length++

                expectation = experience.r + this.gamma * q_value
            }

            // Do feedforward on s0 of the current policy network and set the output activations as labels
            let labels = [...this.policy_network.layers[layer_count - 1].feedforward(experience.s0, null).output]

            // Replace the label for the experience's action because that's the only one we can say anything about
            labels.splice(experience.a, 1, expectation)

            // Get the gradient for this experience with backpropagation
            this.policy_network.layers[layer_count - 1].labels = labels
            this.policy_network.layers[1].backprop()
        }

        // Apply the total gradient (nudges) from backprop to each layer
        for (let l = 1; l < layer_count; l++) { // we skip the input layer
            let layer = this.policy_network.layers[l]
            layer.apply_nudges(batch.length, this.eta) // we use batch.length and not this.batch_size because the batch might be smaller in some instances
        }
    }

    update() {
        // Maybe let the decrease depend on how much of the high score or avg it got?
        if (this.epsilon > this.epsilon_end) {
            // this.epsilon -= this.epsilon_decay
            // this.epsilon -= this.epsilon*this.epsilon_decay
            this.epsilon = this.epsilon*this.epsilon_decay
        } else if (this.epsilon < this.epsilon_end && this.epsilon != 0) {
            this.epsilon = this.epsilon_end
        } 

        this.q_log.sum = 0
        this.q_log.length = 0
    }

    reset() {
        console.log("reset parameters")

        // Re init policy network
        for (let l = 1; l < this.policy_network.depth; l++) {
            let layer = this.policy_network.layers[l]
            layer.reset()
        }
        this.update_target_network()

        this.current_memory = {}
        this.epsilon = this.epsilon_begin
        this.target_update_timer = 0
        this.q_log = {sum:0,length:0}
    }    

    // Other functions
    get_total_neurons() {
        let total_neurons = 0
        for (let layer of this.policy_network.layers) {
            total_neurons += layer.size
        }
        return total_neurons
    }

    get_total_parameters() {
        let total_parameters = 0
        for (let l = 1; l < this.policy_network.depth; l++) {
            let layer = this.policy_network.layers[l]
            total_parameters += layer.biases.length + layer.size * this.policy_network.layers[l-1].size
        }
        return total_parameters
    }

    get_layer_design() {
        let layer_design = []

        for (let layer of this.policy_network.layers) {
            layer_design.push(layer.size)
        }
        return layer_design
    }

    get_params() {
        let params = [{}]
        for (let l = 1; l < this.policy_network.layers.length; l++) {
            let layer = this.policy_network.layers[l]
            let biases = []
            let weights = [[]]

            for (let node of layer.biases) {
                biases.push(node)
            }
            for (let n in layer.weights) {
                let node = layer.weights[n]
                weights.push([])
                for (let prev_node of node) {
                    weights[n].push(prev_node)
                }
            }

            params.push({
                biases: biases,
                weights: weights,
            })
        }

        return {
            layer_design: this.get_layer_design(),
            parameters: params,
        }
    }

    get_weights() {
        let weight_layers = [[]]
        for (let l = 1; l < this.policy_network.layers.length; l++) {
            let layer = this.policy_network.layers[l]
            let weights = [[]]

            for (let n in layer.weights) {
                let node = layer.weights[n]
                weights.push([])
                for (let prev_node of node) {
                    weights[n].push(prev_node)
                }
            }
            weight_layers.push(weights)
        }

        return weight_layers
    }

    get_activations() {
        let activations = []
        for (let l = 0; l < this.policy_network.layers.length; l++) {
            let layer = this.policy_network.layers[l]
            let as = []

            for (let a of layer.activations) {
                as.push(a)
            }
            activations.push(as)
        }

        return activations        
    }

    set_params(layer_design, params) {
        if (!layer_design || !params || layer_design.length < 1 || params.length < 1) {
            console.log("invalid parameter file, compare with a new saved one to check")
            return false
        }
        let ld = this.get_layer_design()

        for (let l in layer_design) {
            let layer_size = layer_design[l]
            if (layer_size != ld[l]) {
                console.log("layer design doesn't match")
                return false
            }
        }

        for (let l = 1; l < this.policy_network.layers.length; l++) {
            let layer = this.policy_network.layers[l]

            for (let n in layer.biases) {
                layer.biases[n] = params[l]["biases"][n]
            }
            for (let n in layer.weights) {
                let node = layer.weights[n]
                for (let pn in node) {
                    node[pn] = params[l]["weights"][n][pn]
                }
            }
        }
        this.update_target_network()

        console.log("parameters copied.")
        return true
    }

    change_buffer_size(new_size) {
        if (new_size < this.replay_memory.length) {
            this.replay_memory.splice(0, this.replay_memory.length - new_size)
        }
        this.max_memory = new_size
    }

}