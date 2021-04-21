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
    document.body.style.display = 'block'
    document.body.style.padding = '10px'

    let innerHTML = `
    <div id="content_div" style="display: grid; align-items: center; justify-items: center; width:100%; height:100%; grid-template-rows: 40% 60%;">
      <div id="content_top_div" style="display: grid; align-items: end; justify-items: center; grid-template-columns: 35% 30% 35%; width: 100%; height:100%;">
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
        <div id="content_top_right_div">
          <div id="content_top_right_main_div">
            <table><tr>
              <td><input id="epoch_btn" name="steps" type="radio">epoch</input></td>
              <td id="epoch_nr"></td>
            </tr><tr>
              <td><input id="batch_btn" name="steps" type="radio">batch</input></td>
              <td id="batch_nr"></td>
            </tr><tr>
              <td><input id="example_btn" name="steps" type="radio">example</input></td>
              <td id="example_nr"></td>
            </tr><tr>                        
              <td>last score</td>
              <td id="last_score"></td>
            </tr><tr>
              <td>best score</td>
              <td id="best_score"></td>
            </tr><tr>
              <td>epochs since best cost (training)</td>
              <td id="epochs_since_best"></td>
            </tr><tr>
              <td>total parameters</td>
              <td id="total_parameters"></td>
            </tr><tr>
              <td>total neurons</td>
              <td id="total_neurons"></td>                                                        
            </tr></table>
          </div>
          <input id="speed_slider" type="range" min=0 max=10 value=5 style="width:100%;">
          <div id="content_top_right_bar_div" style="display: grid; grid-template-columns: 49% 49%; column-gap: 2%;">
            <button id="reset_btn" class="btn">Reset</button>
            <button id="settings_btn" class="btn">Settings</button>
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
    `

    document.body.insertAdjacentHTML('beforeend', innerHTML) 
  }

  updateStats(nn) {
    document.getElementById("epoch_nr").innerHTML = nn.epoch_nr
    document.getElementById("batch_nr").innerHTML = `${nn.epoch.batch_nr}/${nn.batches.length}`
    document.getElementById("example_nr").innerHTML = `${nn.epoch.example_nr}/${nn.batches[nn.epoch.batch_nr].length}`
    document.getElementById("last_score").innerHTML = nn.test_scores[0].toFixed(2)
    document.getElementById("best_score").innerHTML = nn.best_test_score.toFixed(2)
    document.getElementById("epochs_since_best").innerHTML = nn.epochs_since_best
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


    if (height / width > height_width_ratio) {

      // TODO: mobile mode

    } else {
    }

    // this.context.imageSmoothingEnabled = false;

  }

  render() { 
    this.context.input.drawImage(this.buffer.input.canvas, 0, 0, this.buffer.input.canvas.width, this.buffer.input.canvas.height, 0, 0, this.canvas.input.width, this.canvas.input.height); 
    this.context.labels.drawImage(this.buffer.labels.canvas, 0, 0, this.buffer.labels.canvas.width, this.buffer.labels.canvas.height, 0, 0, this.canvas.labels.width, this.canvas.labels.height);   
    this.context.nn.drawImage(this.buffer.weights.canvas, 0, 0, this.buffer.weights.canvas.width, this.buffer.weights.canvas.height, 0, 0, this.canvas.nn.width, this.canvas.nn.height);   
    this.context.nn.drawImage(this.buffer.activations.canvas, 0, 0, this.buffer.activations.canvas.width, this.buffer.activations.canvas.height, 0, 0, this.canvas.nn.width, this.canvas.nn.height);   
  }  

}