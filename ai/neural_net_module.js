import { InputLayer, DenseLayer, OutputLayer } from "./layers.js"
import {mnist} from "./mnist_16k.js"

// ==============================================

window.NeuralNet = class NeuralNet {
    constructor(data=mnist, layer_design, test_ratio=.1, seed=0, printing=0) {
        this.printing = printing
        this.eta = 1
        this.activation_func = "sigmoid"

        // Data is a list of objects like {x: input, y: label} with x as a list of input activations and y as a list of possible outcomes where the correct one has 1 as value
        shuffleArray(data)
        this.test_data = data.splice(0, Math.floor(data.length*test_ratio))
        this.data = data
        this.seed = seed

        this.depth = layer_design.length + 2
        // Layers is a list of types and sizes for each layer like [{type:"Dense", size:16},{type:"Dense",size:16}] 
        // excluding the input and output layer as that's implied by the data
        this.layers = this.init_layers(layer_design, data)

        this.total_neurons = this.get_total_neurons()
        this.total_parameters = this.get_total_parameters()

        // Trackers --------------------------------
        let worst_case = data[0].y.length // This is the maximum cost
        this.best_training_cost = worst_case
        this.training_costs = [worst_case]
        this.test_costs = [worst_case]

        this.best_test_score = 0
        this.test_scores = [1/worst_case]
        this.training_scores = [1/worst_case]

        this.epoch_nr = 0
        this.epochs_since_best = 0
        // -----------------------------------------

        this.batches = this.init_batches()

        this.epoch = new Epoch(this)
    }

    init_layers(layer_design, data) {
        let layers = []
        layers.push(new InputLayer(
            this, 
            data[0].x.length, 
            null,
            )) // Add first layer

        for (let l in layer_design) {
            let l_info = layer_design[l]
            switch(l_info.type) {
                case "Dense":
                    layers.push(new DenseLayer(
                        this, 
                        l_info.size, 
                        layers[l]))
                    break
            }
        }
        layers.push(new OutputLayer(
            this, 
            data[0].y.length, 
            layers[this.depth-2])) // Add output layer

        return layers
    }

    get_total_neurons() {
        let total_neurons = 0
        for (let layer of this.layers) {
            total_neurons += layer.size
        }
        return total_neurons
    }

    get_total_parameters() {
        let total_parameters = 0
        for (let l = 1; l < this.depth; l++) {
            let layer = this.layers[l]
            total_parameters += layer.biases.length + layer.size * this.layers[l-1].size
        }
        return total_parameters
    }

    init_batches(batch_size=100) {
        // Divide data into batches
        shuffleArray(this.data)
        let batches = [[]]
        if (this.printing >= 0) console.log("Making Batches")
        let batch_nr = 0
        for (let index in this.data) {
            if (index % batch_size == 0 && index > 0) {
                batches.push([]);
                batch_nr += 1;
            }
            batches[batch_nr].push(this.data[index])
        }
        if (this.printing >= 0) console.log("Batches done")
        return batches
    }

    test_example(input) {
        this.layers[this.depth-1].feedforward(input, null)

        // Gather activations
        let activations = []
        for (let layer of this.layers) {
            activations.push(layer.activations)
        }

        return activations
    }

    evaluate() {
        let score = 0
        let cost = 0
        for (let i of this.test_data) {
            let res = this.layers[this.depth-1].feedforward(i.x, i.y)
            score += res.score
            cost += res.cost
        }
        let len = this.test_data.length
        score /= len
        cost /= len
        this.test_scores.unshift(score)
        this.test_costs.unshift(cost)

        if (score > this.best_test_score) this.best_test_score = score
    }

    get_weights() {
        // Gather weights
        let weights = [[]]
        for (let l = 1; l < this.depth; l++) { // First layer doesn't have weights so we skip
            let layer = this.layers[l]
            weights.push([])
            for (let node of layer.weights) {
                weights[l].push([...node])
            }
        }
        
        return weights
    }

    reset() {
        for (let l = 1; l < this.depth; l++) {
            let layer = this.layers[l]
            layer.reset()
        }

        // Trackers --------------------------------
        let worst_case = this.data[0].y.length // This is the maximum cost
        this.best_training_cost = worst_case
        this.training_costs = [worst_case]
        this.test_costs = [worst_case]

        this.best_test_score = 0
        this.test_scores = [1/worst_case]
        this.training_scores = [1/worst_case]

        this.epoch_nr = 0
        this.epochs_since_best = 0
        // -----------------------------------------

        this.epoch.reset()
    }
}

class Epoch {
    constructor(network) {
        this.network = network

        this.training_score = 0
        this.training_cost = 0

        if (this.network.printing > 0) {
            console.log(`======= STARTING EPOCH ${this.network.epoch_nr} =======`) }
        this.batch_nr = 0
        this.example_nr = 0

        this.cumulative_time = 0
    }

    step_epoch() {
        // All the incrementing is done in step_example
        let epoch_nr = this.network.epoch_nr
        while (epoch_nr == this.network.epoch_nr) {
            this.step_example()
        }
    }

    step_batch() {
        // All the incrementing is done in step_example
        let batch_nr = this.batch_nr
        while (batch_nr == this.batch_nr) {
            this.step_example()
        }
    }

    step_example() {
        if (this.example_nr >= this.network.batches[this.batch_nr].length)   this.finish_batch()
        let batch = this.network.batches[this.batch_nr]
        let example = batch[this.example_nr]

        let t0 = Date.now()

        let layers = this.network.layers
        let res = layers[this.network.depth-1].feedforward(example.x, example.y)
        this.training_score += res.score
        this.training_cost += res.cost
        layers[1].backprop()

        // Gather activations
        let activations = []
        for (let layer of layers) {
            activations.push(layer.activations)
        }

        this.example_nr++
        this.cumulative_time += Date.now() - t0

        return {
            x: example.x, // Input
            y: example.y, // One-hot Label
            activations: activations,
            correct: res.score,
            label: res.label,
            prediction: res.prediction,
        }
    }

    finish_batch() {
        // Apply the total nudges from backprop to each layer
        let batch = this.network.batches[this.batch_nr]
        for (let l = 1; l < this.network.depth; l++) { // we skip the input layer
            let layer = this.network.layers[l]
            layer.apply_nudges(batch.length, this.network.eta)
        }
        
        // Set batch
        this.batch_nr++
        this.example_nr = 0

        if (this.batch_nr >= this.network.batches.length) this.finish_epoch()
    }

    finish_epoch() {
        let network = this.network
        network.training_scores.unshift(this.training_score/network.data.length)
        network.training_costs.unshift(this.training_cost/network.data.length)

        // Test if the cost improved with nudges from last epoch
        if (network.training_costs[0] < network.best_training_cost) {
            network.best_training_cost = network.training_costs[0]
            network.epochs_since_best = 0
        } else {
            network.epochs_since_best += 1
        }

        if (this.network.printing > 0) { console.log(`Finished epoch in ${this.cumulative_time/1000} seconds`) }

        // Evaluate on test-data
        this.network.evaluate()

        // Set epoch
        this.network.epoch_nr++
        this.reset()

        if (this.network.printing > 0) { console.log(`======= STARTING EPOCH ${this.network.epoch_nr} =======`) }
    }

    reset() {
        this.training_score = 0
        this.training_cost = 0
        this.batch_nr = 0
        this.example_nr = 0
        this.cumulative_time = 0

        this.network.batches = this.network.init_batches()
    }
}

// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}