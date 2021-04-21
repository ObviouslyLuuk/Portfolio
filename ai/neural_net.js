import { InputLayer, DenseLayer, OutputLayer } from "./layers.js"

// ==============================================

export class Network {
    constructor(data, layers, seed=0) {
        // Data is a list of objects like {x: input, y: label} with x as a list of input activations and y as a list of possible outcomes where the correct one has 1 as value
        this.data = data
        this.seed = seed

        // Layers is a list of types and sizes for each layer like [{type:"Dense", size:16},{type:"Dense",size:16}] 
        // excluding the input and output layer as that's implied by the data
        this.depth = layers.length + 2
        this.layers = []
        this.layers.push(new InputLayer(
            this, 
            data[0].x.length, 
            null,
            )) // Add first layer

        for (let l in layers) {
            let l_info = layers[l]
            switch(l_info.type) {
                case "Dense":
                    this.layers.push(new DenseLayer(
                        this, 
                        l_info.size, 
                        this.layers[l]))
                    break
            }
        }
        this.layers.push(new OutputLayer(
            this, 
            data[0].y.length, 
            this.layers[this.depth-2])) // Add output layer

        this.best_cost = data[0].y.length // This is the maximum cost
        this.best_biases = this.biases
        this.best_weights = this.weights
        this.cost = null // unused?
        this.score = null
    }


    SGD(epochs, batch_size=100, eta=1, printing=0, detailed_time=false) {
        // Stochastic Gradient Descent

        // Divide data into batches
        if (printing >= 0) console.log("Making Batches")
        let batches = [[]]
        let batch_nr = 0
        for (let index in this.data) {
            if (index % batch_size == 0 && index > 0) {
                batches.push([]);
                batch_nr += 1;
            }
            batches[batch_nr].push(this.data[index])
        }

        let not_improved_tracker = 0

        // Starting Training
        if (printing >= 0) console.log("Starting Training")
        // Starting Epoch
        for (let epoch = 0; epoch < epochs; epoch++) {
            if (printing == 0) {
                this.cost = 0
                this.score = 0
                var t0 = Date.now()
                console.log(`======= STARTING EPOCH ${epoch} =======`)
            }
            let epoch_score = 0
            // Starting Batch
            for (let batch_nr in batches) {
                if (printing >= 1) {
                    this.cost = 0
                    this.score = 0
                    console.log(`======= STARTING EPOCH ${epoch}, BATCH ${batch_nr} =======`)
                }

                let batch = batches[batch_nr]

                // Do backprop on each example in a batch
                let new_cost = 0
                for (let i of batch) {
                    let res = this.layers[this.depth-1].feedforward(i.x, i.y)
                    this.score += res.score
                    new_cost += res.cost
                    this.layers[1].backprop()
                }
                new_cost /= batch.length

                // Test if the cost improved with nudges from last batch
                if (new_cost < this.best_cost) {
                    this.best_cost = new_cost
                    not_improved_tracker = 0
                } else {
                    not_improved_tracker += 1
                }

                // Apply the total nudges from backprop to each layer
                for (let l = 1; l < this.depth; l++) { // we skip the input layer
                    let layer = this.layers[l]
                    layer.apply_nudges(batch.length, eta)
                }

                // print stuff
                if (printing >= 1) {
                    // We use epoch_score because we want to know the average of this epoch so far as well as the current batch
                    epoch_score += this.score

                    console.log(`======= Cost: ${new_cost}`)
                    console.log(`======= Best Cost: ${this.best_cost}, ${not_improved_tracker} batches ago`)
                    console.log(`======= Score: ${this.score / batch.length} avg ${epoch_score / (batch_nr*batch_size + batch.length)}`)
                    console.log(`======= Eta: ${eta}`)
                }
            }
            if (printing == 0) {
                console.log(`======= Best Cost: ${this.best_cost}, ${not_improved_tracker} batches ago`)
                console.log(`======= Score: ${this.score / this.data.length}`)

                if (detailed_time) {
                    for (let l = 1; l < this.layers.length; l++) {
                        let layer = this.layers[l]
                        let time = layer.time
                        console.log(`======= Layer ${l}`)
                        for (let key of Object.keys(time)) {
                            console.log(`======== ${key}: ${time[key]}`)
                            time[key] = 0

                            if (layer.filters && key == "Feedforward") {
                                console.log(`========= Convolution: ${layer.filters[0].time.Convolution}`)
                                layer.filters[0].time.Convolution = 0
                            }
                        }
                    }
                }
                console.log(`================================ ${(Date.now() - t0)/1000} seconds`)
            }  
        }
    }
}