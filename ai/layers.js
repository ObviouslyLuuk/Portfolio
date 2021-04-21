import { ReLU, ReLU_prime, sigmoid, sigmoid_prime } from "./activation_functions.js"
import { get_max_value_index } from "./helper.js"

// Random Inititialization stuff ==================================================
// import { seeded_rand } from "./random.js"
function seeded_rand(seed) {return (Math.random()-.5)*.5}

// ================================================================================
export class Layer {
    constructor(network, size, prev_layer) {
        this.net = network
        this.prev_layer = prev_layer
        this.next_layer = null

        this.size = size
        this.activations = []
        this.zs = []

        this.time = {
            "Feedforward": 0,
            "Backprop": 0
        }
    }

    save_best() {
        this.best_biases = this.biases
        this.best_weights = this.weights
    }

    set_best() {
        this.biases = this.best_biases
        this.weights = this.best_weights
    }

    reset() {
        this.biases = this.init_biases()
        this.weights = this.init_weights()
    }
}

// ================================================================================
export class InputLayer extends Layer {
    constructor(network, size, prev_layer, dimensions=null, channel_amount=1) {
        super(network, size, prev_layer)
        this.dimensions = dimensions
        this.channel_amount = channel_amount
        this.is_input = true
    }

    feedforward(input) {
        let t0 = Date.now()

        if (!this.dimensions) {
            this.dimensions = [input.length,1]
        }
        this.activations = input

        this.time.Feedforward += Date.now() - t0
        return this.activations
    }
}

// ================================================================================
export class OutputLayer extends Layer {
    constructor(network, size, prev_layer) {
        super(network, size, prev_layer)
        this.labels = null

        this.biases = this.init_biases()
        this.weights = this.init_weights()
        this.total_bias_nudges = this.init_biases(true)
        this.total_weight_nudges = this.init_weights(true)
        this.prev_layer.next_layer = this

        this.best_biases = this.biases
        this.best_weights = this.weights        
    }

    init_biases(set_zero=false) {
        let biases = []
        
        for (let node = 0; node < this.size; node++) {
            if (!set_zero)
                biases.push(seeded_rand(this.net.seed))
            else
                biases.push(0)
        }
        return biases
    }

    init_weights(set_zero=false) {
        let weights = []

        for (let node = 0; node < this.size; node++) {
            weights.push([])
            for (let prev_node = 0; prev_node < this.prev_layer.size; prev_node++) {
                if (!set_zero)
                    weights[node].push(seeded_rand(this.net.seed))
                else
                    weights[node].push(0)
            }
        }
        return weights
    }

    feedforward(input, labels) {
        let prev_activations = this.prev_layer.feedforward(input)
        let t0 = Date.now()

        this.labels = labels
        this.activations = []
        this.zs = []
        let cost = 0

        for (let j = 0; j < this.size; j++) {
            let z = this.biases[j]
            for (let k = 0; k < prev_activations.length; k++) {
                z += this.weights[j][k] * prev_activations[k]
            }
            if (this.net.activation_func == "sigmoid") {
                this.zs.push(z)
                this.activations.push( sigmoid(z) ) }
            else this.activations.push( z )

            if (labels) {
                cost += Math.pow(this.activations[j] - parseInt(labels[j]), 2)                
            }

        }
        // Add one to the score if the prediction was correct
        let score = 0
        let eval_res = this.evaluate_output(labels)
        if (eval_res.correct)
            score = 1

        this.time.Feedforward += Date.now() - t0
        return {
            output: this.activations, 
            cost: cost, 
            score: score, 
            label: eval_res.label, 
            prediction: eval_res.prediction
        }
    }

    evaluate_output(labels) {
        if (!labels) return {correct: null, label: null, prediction: get_max_value_index(this.activations)}

        let prediction = get_max_value_index(this.activations)
        let label = get_max_value_index(labels)
        return {correct: (prediction == label), label: label, prediction: prediction}
    }

    backprop() {
        let t0 = Date.now()

        let prev_a_nudges = []
        for (let j = 0; j < this.size; j++) {
            let d_a = 2*(this.activations[j] - this.labels[j]) // derivative of Cost with respect to the activation (only for the last layer)
            let d_bias
            if (this.net.activation_func == "sigmoid") 
                d_bias = sigmoid_prime(this.zs[j]) * d_a // derivative of Cost with respect to the bias
            else d_bias = d_a // derivative of Cost with respect to the bias
            this.total_bias_nudges[j] += d_bias

            for (let k = 0; k < this.prev_layer.size; k++) {
                let d_weight = this.prev_layer.activations[k] * d_bias // derivative of Cost with respect to the weight
                this.total_weight_nudges[j][k] += d_weight

                // Every element in prev_a_nudges becomes the weighted sum of the derivatives of Cost with respect to all activations on this layer
                // (in other words, the effect the a with index k on the prev_layer has on all the subsequent activations and therefore Cost)
                if (j == 0) prev_a_nudges.push(0)

                // here bias_nudges = sigmoid_prime(this.zs[j]) * d_a of this layer
                prev_a_nudges[k] += this.weights[j][k] * d_bias
            }
        }
        this.time.Backprop += Date.now() - t0
        return prev_a_nudges
    }

    apply_nudges(batch_size, eta) {
        for (let j = 0; j < this.size; j++) {
            let bias_nudge = this.total_bias_nudges[j]
            this.biases[j] -= eta * bias_nudge / batch_size

            for (let k = 0; k < this.prev_layer.size; k++) {
                let weight_nudge = this.total_weight_nudges[j][k]
                this.weights[j][k] -= eta * weight_nudge / batch_size
            }               
        }
        this.total_bias_nudges = this.init_biases(true)
        this.total_weight_nudges = this.init_weights(true)
    }
}

// ================================================================================
export class DenseLayer extends Layer {
    constructor(network, size, prev_layer) {
        super(network, size, prev_layer)
        this.biases = this.init_biases()
        this.weights = this.init_weights()
        this.total_bias_nudges = this.init_biases(true)
        this.total_weight_nudges = this.init_weights(true)   
        this.prev_layer.next_layer = this
        
        this.best_biases = this.biases
        this.best_weights = this.weights
    }

    init_biases(set_zero=false) {
        let biases = []
        
        for (let node = 0; node < this.size; node++) {
            if (!set_zero)
                biases.push(seeded_rand(this.net.seed))
            else
                biases.push(0)
        }
        return biases
    }

    init_weights(set_zero=false) {
        let weights = []

        for (let node = 0; node < this.size; node++) {
            weights.push([])
            for (let prev_node = 0; prev_node < this.prev_layer.size; prev_node++) {
                if (!set_zero)
                    weights[node].push(seeded_rand(this.net.seed))
                else
                    weights[node].push(0)
            }
        }
        return weights
    }

    feedforward(input) {
        let prev_activations = this.prev_layer.feedforward(input)
        let t0 = Date.now()

        this.activations = []
        this.zs = []
        for (let j = 0; j < this.size; j++) {
            let z = this.biases[j]
            for (let k = 0; k < prev_activations.length; k++) {
                z += this.weights[j][k] * prev_activations[k]
            }
            this.zs.push(z)
            if (this.net.activation_func == "sigmoid") 
                this.activations.push( sigmoid(z) )
            else this.activations.push( ReLU(z) )
        }

        this.time.Feedforward += Date.now() - t0
        return this.activations
    }

    backprop() {
        let a_nudges = this.next_layer.backprop()
        let t0 = Date.now()

        let first_hidden_layer = this.prev_layer.is_input

        let prev_a_nudges = []
        for (let j = 0; j < this.size; j++) {
            let d_bias
            if (this.net.activation_func == "sigmoid")
                 d_bias = sigmoid_prime(this.zs[j]) * a_nudges[j] // derivative of Cost with respect to the bias
            else d_bias = ReLU_prime(this.zs[j]) * a_nudges[j] // derivative of Cost with respect to the bias
            this.total_bias_nudges[j] += d_bias

            for (let k = 0; k < this.prev_layer.size; k++) {
                let d_weight = this.prev_layer.activations[k] * d_bias // derivative of Cost with respect to the weight
                this.total_weight_nudges[j][k] += d_weight
            
                if (first_hidden_layer) continue
                // Every element in prev_a_nudges becomes the weighted sum of the derivatives of Cost with respect to all activations on this layer
                // (in other words, the effect the a with index k on the prev_layer has on all the subsequent activations and therefore Cost)
                if (j == 0) prev_a_nudges.push(0)

                // here d_bias = sigmoid_prime(this.zs[j]) * d_a of this layer
                prev_a_nudges[k] += this.weights[j][k] * d_bias
            }            
        }
        this.time.Backprop += Date.now() - t0
        return prev_a_nudges 
    }

    apply_nudges(batch_size, eta) {
        for (let j = 0; j < this.size; j++) {
            this.biases[j] -= eta * this.total_bias_nudges[j] / batch_size

            for (let k = 0; k < this.prev_layer.size; k++) {
                this.weights[j][k] -= eta * this.total_weight_nudges[j][k] / batch_size
            }               
        }
        this.total_bias_nudges = this.init_biases(true)
        this.total_weight_nudges = this.init_weights(true)
    }
}