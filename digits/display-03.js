const COOL_GREEN = '99, 255, 132'
const COOL_BLUE = '0, 115, 255'
const COOL_RED = '255, 99, 132'

class Display {
  constructor() {

    this.initElements()

    this.buffer  = {
      input:        document.createElement("canvas").getContext("2d"),
      weights:      document.createElement("canvas").getContext("2d"),
      activations:  document.createElement("canvas").getContext("2d"),
      labels:       document.createElement("canvas").getContext("2d"),
    }

    this.canvas = {
      input:        document.getElementById("draw_grid_canvas"),
      nn:           document.getElementById("nn_canvas"),
      labels:       document.getElementById("nn_labels_canvas"),    
      graph:        document.getElementById("graph_canvas"),
    }

    this.context = {
      input:        this.canvas.input.getContext('2d'),
      nn:           this.canvas.nn.getContext('2d'),
      labels:       this.canvas.labels.getContext('2d'),       
    }

    this.graph = null
    this.rendered_epoch = null

  }

  initElements() {
    document.body.style.color = 'white'
    document.body.style.display = 'grid'
    document.body.style.position = 'relative'
    document.body.style['align-items'] = 'center'

    let innerHTML = `
    <div id="content_wrapper" style="width:100%;height:100%;position:absolute;padding:10px">
    <div id="content_div" style="display: grid; align-items: center; justify-items: center; width:100%; height:100%; grid-template-rows: 40% 60%;">
      <div id="content_top_div" style="display: grid; align-items: end; justify-items: center; grid-template-columns: 35% 30% 35%; width: 100%; height:100%; column-gap:5px">
        <div id="content_top_left_div" style="width: 100%; height:100%">
          <canvas id="graph_canvas"></canvas>
        </div>
        <div id="content_top_middle_div">
          <div id="content_top_middle_main_div" style="display: grid; justify-items: center; margin-bottom: 5px;">
            <canvas id="draw_grid_canvas" width='50px' height='50px' style="width:75%; border: 1px solid white; border-radius: 5px;"></canvas>
          </div>
          <div id="content_top_middle_bar_div" style="display: grid; grid-template-columns: auto auto auto auto; column-gap: 5px;">
            <button id="move_btn" class="btn">Move</button>
            <button id="eraser_btn" class="btn">Eraser</button>
            <button id="draw_btn" class="btn">Draw</button>
            <button id="clear_btn" class="btn">Clear</button>
          </div>
        </div>
        <div id="content_top_right_div" style="width:75%;">
          <div id="table_div" style="display: grid; grid-template-columns: auto auto;">
            <div><input id="epoch_btn" name="steps" type="radio"> <label for="epoch_btn">epoch</label></div>
            <div id="epoch_nr"></div>
          
            <div><input id="batch_btn" name="steps" type="radio"> <label for="batch_btn">batch</label></div>
            <div id="batch_nr"></div>
          
            <div><input id="example_btn" name="steps" type="radio"> <label for="example_btn">example</label></div>
            <div id="example_nr"></div>
          
            <div>last score</div>
            <div id="last_score"></div>
          
            <div>best score</div>
            <div id="best_score"></div>
          
            <!-- <div>epochs since best cost (training)</div>
            <div id="epochs_since_best"></div> -->
          
            <div>total parameters</div>
            <div id="total_parameters"></div>
          
            <div>total neurons</div>
            <div id="total_neurons"></div>
          </div>
          <input id="speed_slider" type="range" min=0 max=10 value=5 style="width:100%;">
          <div id="content_top_right_bar_div" style="display: grid; grid-template-columns: 49% 49%; column-gap: 2%;">
            <button id="reset_btn" class="btn">Reset</button>
            <button id="info_btn" class="btn">Info</button>
          </div>
        </div>
      </div>
      <div id="content_bottom_div" style="display:grid; width:100%; height:100%;">
        <div id="content_bottom_main_div" style="display:grid;">
          <canvas id="nn_canvas" width='1000px' height='230px' style="width: 100%; image-rendering: auto;"></canvas>
        </div>
        <div id="content_bottom_bottom_div" style="display:grid;">
          <canvas id="nn_labels_canvas" width='1000px' height='40px' style="width: 100%; image-rendering: auto;"></canvas>
        </div>
      </div>
    </div>
    </div> 
    `

    let highlights_info = `
    1. Try drawing, erasing and moving your own digits and see if you can tell what features the model looks for in identifying different digits.
    Watch the activations in the network change in real time.
    <br><br>
    2. Try modifying original MNIST digits by clicking "example" and then "draw" when a digit appears you want to adjust.
    <br><br>
    3. Click "Reset" to see a new model train. "example" mode is too slow to see training progress, select "epoch" or "batch" for this.
    Watch the connections (weights) in the network change and get stronger or weaker.
    <br><br>
    4. As more epochs pass, watch for overfitting. You can see this in the line chart if the training-data accuracy keeps rising but the test-data accuracy starts slowly declining.
    `

    let implementation_info = `
    16,000 datapoints (aka examples) from the dataset are used because of memory considerations. First these examples are split into test- and training-data.
    The test-data will never be trained on and serves to check whether the model generalizes to data it's never seen.
    <br><br>
    <b>Feedforward:</b><br>
    The digits of resolution 28x28 are fed into the network by taking each of the 784 pixels, 
    normalizing the brightness value to a number between 0 and 1, and using those 784 numbers as the input activations.
    In the visualization this is the horizontal top of the network, with no discernible neurons because there are so many.
    To get an output the network will perform a process called feedforward, which determines neuron activations in the next layers.
    To determine a single activation it first takes its bias and adds the sum of all the previous layer's weighted activations, 
    we'll define this number as z. 
    The weighted activation is a neuron's activation multiplied by the weight of its connection with the neuron whose activation 
    we're determining (the lines in the visualization). To finally arrive at the activation we map the number z to a range we like, 
    in this case between 0 and 1. We do this mapping using an activation function, specifically the sigmoid in this case.
    <br><br>
    This is done for all neurons after the input layer until we get the output activations.
    The model's guess is simply the neuron with the highest activation in the output layer, which corresponds to a digit as you can see in the visualization.
    <br><br>
    Pseudocode:<br>
    <pre>

    FEEDFORWARD
    <i># I implemented this recursively but for readability I structured it differently here</i>
    input layer = normalized example
    for layer of network {
      if input layer { skip to next layer }
      for neuron of layer {
        sum = 0
        for neuron' of previous layer {
          <i># neuron.weight[neuron'.index] here is the weight between neuron and neuron'</i>
          weighted activation = neuron'.activation * neuron.weight[neuron'.index]
          sum += weighted activation
        }
        neuron.z = sum + neuron.bias
        neuron.activation = activation_function(z)
      }
      if output layer {
        guess = label of the neuron with highest activation
      }
    }
    </pre>
    <b>Backpropagation:</b><br>
    At the start of training, all parameters (weights and biases) are initialized randomly, in this case to a number between -0.25 and 0.25.
    This means that feedforward won't produce any meaningful outputs at first; the accuracy rate of its digit identifications will be close to
    0.1, the same as guessing randomly. The way we train the neural network is with a process called backpropagation. After the feedforward
    has determined the output activations, we can calculate the error (aka cost). 
    <br><br>
    To get the error you take the difference between an output activation and its target, and sum that for all output neurons.
    There are nuances in how this difference is calculated but the simplest one is just (target - activation).
    The target for an output neuron is either 1 or 0. Lets say the correct identification was 9, then the targets would be: [0,0,0,0,0,0,0,0,0,1],
    whilst the output activations might be [0.56, 0.36, 0.26, 0.02, 0.15, 0.71, 0.42, 0.30, 0.69, 0.84]. As you can see in those activations,
    its guess was correct because 0.84 corresponds to 9 and is the highest activation. However, ideally this activation would be 1 because it's
    correct, and all other activations would be 0 because they aren't. Now we need to use this information to find out how to nudge the
    model parameters in the right direction.
    <br><br>
    Backprop takes the derivative of the error with respect to each weight and bias. This results in a few simple partial derivatives.
    This starts by calculating the derivatives in the output layer, using these to calculate the ones in the previous layer, and repeating this
    until you reach the first layer, hence propogating backwards through the network.
    <br><br>
    After backprop the derivatives for each seperate parameter are added to a nudge for that parameter, which isn't immediately applied...
    <br><br>
    Pseudocode:<br>
    <pre>

    BACKPROPAGATION
    <i># I implemented this recursively but for readability I structured it differently here</i>
    for layer of network in reverse {
      if input layer { done, break out of loop }
      for neuron of layer {
        if output layer {
          <i># derivative of error with respect to neuron.activation</i>
          neuron.d_a = example.targets[neuron.index] - neuron.activation
        }
        else {
          <i># neuron.d_a has already been calculated in the layer above</i>
        }
        neuron.d_z = (derivative of neuron.activation with respect to neuron.z) * neuron.d_a
        neuron.d_b = (derivative of neuron.z with respect to neuron.bias) * neuron.d_z

        for neuron' of previous layer {
          neuron.d_w[neuron'.index] = (derivative of neuron.z with respect to neuron.weight[neuron'.index]) * neuron.d_z

          <i># the weight between neuron and neuron' is the derivative of neuron.z with respect to neuron'.activation
          # this needs to be summed for all neurons in the current layer to get:
          # the derivative of error with respect to neuron'.activation</i>
          neuron'.d_a += neuron.weight[neuron'.index] * neuron.d_z
        }
      }
    }
    return the d_b and d_w for each bias and weight
    </pre>
    <b>Mini-batch Gradient Descent:</b><br>
    To spread these nudges over time but also take a (hopefully) representative sample of our training-data we apply these nudges after
    a certain amount of examples, dividing the parameter nudge by the amount of examples to get an average nudge per example.
    At the start of training the training-data is randomly split into batches with that certain amount of examples. You can adjust the amount
    in the settings below. The parameter nudges are multiplied by a factor called eta (aka learning rate). If eta is too large the model
    might overshoot its target and never recover, but if it's too small it might take too long to get to a good set of parameters.
    <br><br>
    Each pass through all the batches / training-data is what we call an epoch. At the end of each of these we evaluate the model by checking its
    accuracy on the test-data using feedforward.
    <br><br>
    Mini-batch gradient descent is often also referred to as stochastic gradient descent. This is arguably inaccurate, as SGD originally
    described nudging the parameters at every example. However, language evolves all the time.
    <br>
    The reason we spread the nudges at all is that it'd be very computationally expensive to train on the whole training-data at once, 
    with the batch size set to the total amount of examples in the training-data, so to speak. Nudging for every example is relatively 
    computationally inexpensive but this makes the learning much more noisy as no single example is a good representation of the dataset.
    With mini-batch gradient descent we take the middle road.
    <br><br>
    Pseudocode:<br>
    <pre>

    MINI-BATCH GRADIENT DESCENT
    Split data into test- and training-data
    Initialize the weights and biases randomly
    for each epoch {
      randomly split the training-data into new batches
      for each batch of training-data {
        initialize nudge per parameter
        for each example of batch {
          feedworward(example)
          backpropagation(example)
          add derivatives of weights and biases to their respective parameter nudge
        }
        apply the parameter nudges, multiplied by eta
      }
      evaluate model on test-data
    }
    </pre>
    `

    let controls_info = `
    <div style="display: grid; grid-template-columns: auto auto; column-gap: 5px;">
      <div>epoch</div>
      <div>Visualize per epoch. Good for training quickly and seeing big steps of progress. Doesn't visualize examples</div>

      <div>batch</div>
      <div>Visualize per batch. Good for visualizing small changes in weights. Doesn't visualize examples</div>

      <div>example</div>
      <div>Visualize per example. Good for visualization but trains extremely slowly</div>

      <div><br></div><div><br></div>

      <div>Slider</div>
      <div>Adjust the speed of training. Drag to the left to pause</div>

      <div>Reset</div>
      <div>Resets the neural network parameters to a random value</div>

      <div><br></div><div><br></div>

      <div>Draw</div>
      <div>Lets you draw a digit (Click epoch, batch, or example to disable)</div>

      <div>- Move</div>
      <div>Lets you drag the digit around</div>

      <div>- Eraser</div>
      <div>Lets you erase parts of the digit</div>

      <div>- Clear</div>
      <div>Clears the square</div>    
    </div>
    `

    let visualization_info = `
    <b>Neural Network:</b><br>
    The neural network is depicted as a network of lines (the weights), where opacity indicates weight strength. The biases aren't displayed to prevent visual clutter. The nodes in this network are the neurons. If a neuron is currently activated, this is visualized by a circle. Again, opacity indicates activation strength. Blue lines and circles represent negative weights and activations respectively. Below the output neurons their labels are displayed.
    The highest activated label is shown in red when incorrect, and in green when correct.<br>
    <br>
    <b>Input:</b><br>
    The numbers in the square are datapoints from the MNIST dataset. When the network identifies it correctly its border is green, otherwise it's red. When incorrect the speed will slow down temporarily to allow you to see what it got wrong. You can also use this time to press the "Draw" button to change the digit and see how the outcome is affected.<br>
    <br>
    <b>Chart:</b><br>
    The chart doesn't start until after the first finished epoch. Enable epoch training to speed this up.<br>
    In the line chart the green line represents the accuracy on the test-data, and the white on the training-data. The test-data is split off from the complete dataset before training. This is to see if the model generalizes to data it's never trained on.<br>
    <br>
    <b>Stats:</b>
    <div style="display: grid; grid-template-columns: auto auto; column-gap:5px;">
      <div>epoch</div>
      <div>The amount of finished training rounds through the entire training-data</div>

      <div>batch</div>
      <div>The training-data consists of batches. This statistic indicates which batch the network is training on and how many there are in total</div>

      <div>example</div>
      <div>Each batch consists of datapoints, these are also called examples. This statistic indicates which example is being displayed and how many there are per batch</div>

      <div><br></div><div><br></div>

      <div>last score</div>
      <div>The test-data accuracy from the last finished epoch</div>

      <div>best score</div>
      <div>The best test-data accuracy on any epoch so far</div>

      <div><br></div><div><br></div>

      <div>total parameters</div>
      <div>The total amount of weights and biases in the neural network</div>

      <div>total neurons</div>
      <div>The total amount of neurons in the network, including input and output</div>
    </div>
    `

    let info_html = `
    In this project a neural network is used to recognize handwritten digits from the famous MNIST dataset.
    <br><br>
    When training a new model, significant progress is to be expected immediately, at default settings. This is very consistent.

    <details>
      <summary><h4>HIGHLIGHTS</h4></summary>
      ${highlights_info}
    </details>
    <br>
    <details>
      <summary><h4>VISUALIZATION</h4></summary>
      ${visualization_info}
    </details>
    <br>
    <details>
      <summary><h4>CONTROLS</h4></summary>
      ${controls_info}
    </details>
    <br>
    <details>
      <summary><h4>IMPLEMENTATION</h4></summary>
      ${implementation_info}
    </details>    
    `

    let settings = `
    <div id="info_div" style="background-color: rgb(0,0,0,.95);width: 90%;height: 90%;border-radius: 20px;z-index: 1;position:absolute;justify-content: center;display:none;">
    <a id="close_info_btn">x</a>
    <div data-simplebar style="width: 100%;height: 100%;padding: 30px;">

      <h2>Info</h2>
      <p>${info_html}</p>
      <br>

      <div id="settings_div" style="border-radius:5px;display: grid;width: 100%;padding: 5px;background-color:rgb(255,255,255,.2);">

        <h2 style="justify-self: center;">Settings</h2>
        <br>
        <div class="settings_div">
          <div>
            <input id="eta"> 
            <label for="eta">Eta</label>
            <p class="settings_expl">This is the factor by which the parameter nudges are multiplied before applying.</p>
          </div>
          <div>
            <input id="batch_size"> 
            <label for="batch_size">Batch Size</label>
            <p class="settings_expl">This is the amount of examples between every parameter nudge application.</p>
          </div>
          <div>
            <button id="load_best_btn" class="btn">Load Best Parameters</button>
            <p class="settings_expl">Loads the best parameters I've trained so far</p>
          </div>
          <div>
            <input id="printing" type="checkbox"> 
            <label for="printing">Printing</label>
            <p class="settings_expl">If set to true this prints some messages in the console when updates happen.</p>
          </div>              
        </div>
        <button id="set_default_btn" class="btn">Set Default</button>
      </div>
    </div>
    </div>
    `

    document.body.insertAdjacentHTML('beforeend', innerHTML)
    document.body.insertAdjacentHTML('beforeend', settings)
  }

  updateStats(nn) {
    document.getElementById("epoch_nr").innerHTML = nn.epoch_nr
    document.getElementById("batch_nr").innerHTML = `${nn.epoch.batch_nr}/${nn.batches.length}`
    document.getElementById("example_nr").innerHTML = `${nn.epoch.example_nr}/${nn.batches[nn.epoch.batch_nr].length}`
    document.getElementById("last_score").innerHTML = nn.test_scores[0].toFixed(2)
    document.getElementById("best_score").innerHTML = nn.best_test_score.toFixed(2)
    // document.getElementById("epochs_since_best").innerHTML = nn.epochs_since_best
    document.getElementById("total_parameters").innerHTML = nn.total_parameters
    document.getElementById("total_neurons").innerHTML = nn.total_neurons
  }

  initGraph() {
    this.rendered_epoch = null
    let ctx = this.canvas.graph.getContext('2d')

    let graph = new Chart(ctx, {
      type: 'line',
      data: {
          labels: [],
          datasets: [{
              label: 'test-data accuracy',
              data: [],
              backgroundColor: [`rgba(${COOL_GREEN}, 0.2)`],
              borderColor: [`rgba(${COOL_GREEN}, 1)`],              
              borderWidth: 1
            },{
              label: 'training-data accuracy',
              data: [],
              backgroundColor: ['rgba(255, 255, 255, 0.2)'], // white
              borderColor: ['rgba(255, 255, 255, 1)'],              
              borderWidth: 1
            },
          ]
      },
      options: {
          scales: {
              y: {
                  position: 'right',
                  beginAtZero: true,
                  max: 1,
              }
          },
          interaction: {
            mode: 'index',
            intersect: false,
          },      
          animation: {
            duration: 0
          },   
      }
    });

    return graph
  }

  updateGraph(nn) {
    if (nn.epoch_nr == this.rendered_epoch) return

    let labels = []
    for (let i in nn.test_scores) {labels.push(parseInt(i)+1)}

    this.graph.data.labels = labels
    this.graph.data.datasets[0].data = nn.test_scores.slice().reverse()
    this.graph.data.datasets[1].data = nn.training_scores.slice().reverse()
    this.graph.update()

    this.rendered_epoch = nn.epoch_nr
  }

  drawInput(image) {
    this.context.input.clearRect(0,0,10000,10000)    

    if (!image) return

    let ctx = this.buffer.input

    ctx.clearRect(0,0,28,28)

    for (let r = 0; r < ctx.canvas.height; r++) {
      let row = r*ctx.canvas.width
      for (let c = 0; c < ctx.canvas.width; c++) {
        let value = image[row+c]
        ctx.fillStyle = `rgb(255,255,255,${value})`
        ctx.fillRect(c, r, 1, 1)        
      }
    }
  }

  drawWeights(weights) {
    if (!weights) return

    let ctx = this.buffer.weights

    ctx.canvas.height = this.canvas.nn.height
    ctx.canvas.width = this.canvas.nn.width

    ctx.clearRect(0,0,10000,10000)
    this.context.nn.clearRect(0,0,10000,10000) 

    let layer_height = ctx.canvas.height*.92/(weights.length-1) // *.92 to not go the edges
    let start_height = ctx.canvas.height*.04

    // let max = 0
    // for (let l of weights) {
    //   for (let j of l) {
    //     for (let k of j) {
    //       let value = Math.abs(k)
    //       if (value > max) max = value
    //     }
    //   }
    // }

    for (let l = 1; l < weights.length; l++) {
      let height = start_height + (l)*layer_height
      let prev_height = start_height + (l-1)*layer_height

      let layer = weights[l]
      let node_width = ctx.canvas.width/(layer.length+1)
      let prev_node_width = ctx.canvas.width/(layer[0].length+1)

      for (let j in layer) {
        let p0 = {x: (parseInt(j)+1)*node_width, y: height}

        for (let k in layer[j]) {
          let p1 = {x: (parseInt(k)+1)*prev_node_width, y: prev_height}
          // let value = layer[j][k]/max
          let value = layer[j][k]*.3
          ctx.strokeStyle = `rgb(255,255,255,${value})`
          if (value < 0) ctx.strokeStyle = `rgb(${COOL_BLUE},${-value})`
          ctx.lineWidth = 1
          value = Math.abs(value)
          if (value > 1) ctx.lineWidth += value*.5
          ctx.beginPath()
          ctx.moveTo(p0.x, p0.y)
          ctx.lineTo(p1.x, p1.y)
          ctx.stroke()
        }
      }
    }
  }

  drawActivations(activations) {
    let ctx = this.buffer.activations
    ctx.clearRect(0,0,10000,10000)
    // The content.nn is already cleared in drawWeights

    if (!activations) return

    ctx.canvas.height = this.canvas.nn.height
    ctx.canvas.width = this.canvas.nn.width

    let layer_height = ctx.canvas.height*.92/(activations.length-1) // *.92 to not go the edges
    let start_height = ctx.canvas.height*.04

    for (let l = 0; l < activations.length; l++) {
      let height = start_height + (l)*layer_height

      let layer = activations[l]
      let node_width = ctx.canvas.width/(layer.length+1)
      let radius = node_width / 10

      for (let j in layer) {
        let x = (parseInt(j)+1)*node_width
        let value = layer[j]
        // ctx.strokeStyle = `rgb(255,255,255,${value})`
        ctx.fillStyle = `rgb(255,255,255,${value})`
        ctx.beginPath()
        ctx.ellipse(x, height, radius, radius, 0, 0, 7)
        // ctx.stroke()
        ctx.fill()
      }
    }    
  }

  drawLabels(labels, label=null, prediction=null) {
    if (!labels) return

    if (prediction != null && label != null) {
      if (label == prediction) {
        this.canvas.input.style.border = `2px solid rgb(${COOL_GREEN})`
      }
      else {
        this.canvas.input.style.border = "2px solid red"
      }
    }
    else {
      this.canvas.input.style.border = "1px solid grey"
    }

    let ctx = this.buffer.labels

    ctx.canvas.height = this.canvas.labels.height
    ctx.canvas.width = this.canvas.labels.width

    let height_center = ctx.canvas.height/2
    let part_width = ctx.canvas.width/(labels.length+1)

    ctx.clearRect(0,0,10000,10000)
    this.context.labels.clearRect(0,0,10000,10000)    

    let font_size = ctx.canvas.height *.7
    ctx.font = `${font_size}px Arial`

    for (let l in labels) {
      ctx.fillStyle = 'white'
      if (labels[l] == 1) ctx.fillStyle = `rgb(${COOL_GREEN})` // if correct label
      else if (l == prediction) ctx.fillStyle = 'red' // if expected and not correct
      
      ctx.textAlign = "center"
      let x = (parseInt(l)+1)*part_width
      ctx.fillText(l, x, height_center+font_size/2.5, undefined)
    }
  }  

  resize(width, height, height_width_ratio) {

    let content_top_height = document.getElementById("content_top_div").offsetHeight
    if (!window.mobileCheck()) {
      let middle_width = document.getElementById("content_top_middle_div").offsetWidth
      let side_width = (width - middle_width) / 2

      if (this.graph) {
        this.graph.destroy() 
        this.canvas.graph.height = content_top_height
        this.canvas.graph.width = side_width
        this.graph = this.initGraph()
        this.updateGraph(document.value.nn)
      } else {
        this.canvas.graph.height = content_top_height
        this.canvas.graph.width = side_width
      }

      document.getElementById('content_top_div').style["grid-template-columns"] = `${side_width}px auto ${side_width}px`

      let labels_bar_height = this.canvas.labels.height
      this.canvas.labels.width = width
      this.canvas.labels.height = labels_bar_height
      let content_bottom_height = height - content_top_height
      this.canvas.nn.width = width
      this.canvas.nn.height = content_bottom_height - 5 - labels_bar_height      
    } else { // Mobile
      // If new mobile
      document.getElementsByClassName("settings_div").forEach(element => {
        element.style['grid-template-columns'] = "auto"
      })
      let content_div = document.getElementById("content_div")
      let graph_canvas = document.getElementById("graph_canvas")
      let top_right_div = document.getElementById("content_top_right_div")
      top_right_div.parentElement.removeChild(top_right_div)
      content_div.appendChild(top_right_div)
      graph_canvas.parentElement.removeChild(graph_canvas)
      content_div.appendChild(graph_canvas)

      content_div.style['grid-template-rows'] = 'auto'
      document.getElementById("content_top_div").style['grid-template-columns'] = 'auto'
      // -----

      let labels_bar_height = this.canvas.labels.height
      this.canvas.labels.width = width
      this.canvas.labels.height = labels_bar_height
      let content_bottom_height = height - content_top_height
      this.canvas.nn.width = width
      this.canvas.nn.height = content_bottom_height - labels_bar_height      

    }

  }

  render() { 
    this.context.input.drawImage(this.buffer.input.canvas, 0, 0, this.buffer.input.canvas.width, this.buffer.input.canvas.height, 0, 0, this.canvas.input.width, this.canvas.input.height); 
    this.context.labels.drawImage(this.buffer.labels.canvas, 0, 0, this.buffer.labels.canvas.width, this.buffer.labels.canvas.height, 0, 0, this.canvas.labels.width, this.canvas.labels.height);   
    this.context.nn.drawImage(this.buffer.weights.canvas, 0, 0, this.buffer.weights.canvas.width, this.buffer.weights.canvas.height, 0, 0, this.canvas.nn.width, this.canvas.nn.height);   
    this.context.nn.drawImage(this.buffer.activations.canvas, 0, 0, this.buffer.activations.canvas.width, this.buffer.activations.canvas.height, 0, 0, this.canvas.nn.width, this.canvas.nn.height);   
  }  

}