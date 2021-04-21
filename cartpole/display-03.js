const COOL_GREEN = '99, 255, 132'
const COOL_BLUE = '0, 115, 255'

class Display {
  constructor() {

    this.init_elements()

    this.buffer = {
      cart: document.createElement("canvas").getContext("2d"),
      weights:      document.createElement("canvas").getContext("2d"),
      activations:  document.createElement("canvas").getContext("2d"),
    }

    this.context = {
      cart: document.getElementById("cart_canvas").getContext("2d"),
      nn: document.getElementById("nn_canvas").getContext("2d"),
      graph: document.getElementById("graph_canvas").getContext("2d"),      
    }

    this.graph = null
    this.rendered_episode = null    

    // this.color1     = "#303030";
    // this.color2     = "#992000";    
    this.color1     = 'white';
    this.color2     = `rgb(${COOL_BLUE},.5)`;

    this.scale = 1
  }


  init_elements() {
    document.body.style.color = 'white'
    document.body.style.display = 'block'
    document.body.style.padding = '10px'

    let innerHTML = `
    <div id="content_div" style="width: 100%; height: 100%;display:grid;grid-template-rows:min-content;">
      <div id="content_top_div" style="display: grid; grid-template-columns: auto 60%; align-items: center; column-gap:5px;">
        <div id="content_top_left_div" style="height:100%;display:grid;align-items:end;">
          <div id="table_div" style="display: grid; grid-template-columns: auto auto;">
            <div>Episode</div>
            <div id="episode_nr"></div>
            <div>Best</div>
            <div id="best_score"></div>
            <div>Avg</div>
            <div id="avg_score"></div>
            <div>Episodes since best</div>
            <div id="episodes_since_best"></div>
            <div>epsilon (exploration)</div>
            <input id="epsilon" style="width:50px"></input>
            <div><input id="learn_checkbox" type="checkbox" checked> eta (learning)</div>
            <input id="eta" style="width:50px"></input>
            <div>total parameters</div>
            <div id="total_parameters"></div>
            <div>total neurons</div>
            <div id="total_neurons"></div>                  
          </div>
          <div id="speed_div" style="display:grid; grid-template-columns:auto min-content;">
            <input id="speed_slider" type="range" min=0 max=10 value=5 style="width:100%;">
            <div id="fps"></div>
          </div>
          <div id="content_top_left_bar_div" style="display:grid; grid-template-columns:auto auto auto auto; column-gap:5px;">
            <button id="settings_btn" class="btn">Settings</button>
            <button id="reset_btn" class="btn">Reset</button>
            <button id="save_btn" class="btn">Save</button>
            <input id="load_btn" type="file" name="files[]" style="display:none;">
            <label for="load_btn" class="btn btn-light" style="margin: 0;">Load</label> 
          </div>
        </div>
        <div id="content_top_right_div">
          <div id="content_top_right_canvas_div" style="position: relative; margin-top:5px">
            <div id="current_score" style="position:absolute; padding-inline: 5px;">Score: 0</div>
            <canvas id="cart_canvas" style="width:100%; border: 2px solid grey; border-radius: 5px; image-rendering: auto;"></canvas>
          </div>
          <div id="content_top_right_bar_div" style="display: grid;">
            <button id="drive_btn" class="btn">Drive</button>
          </div>
        </div>
      </div>
      <div id="content_bottom_div" style="height:100%;display: grid; grid-template-columns: 50% 50%;">
        <div id="graph_canvas_div" style="display:grid"><canvas id="graph_canvas"></canvas></div>
        <div id="nn_canvas_div" style="display:grid"><canvas id="nn_canvas" style="image-rendering: auto;"></canvas></div>
      </div>
    </div>
    ` 

    document.body.insertAdjacentHTML('beforeend', innerHTML) 
  }
  
  updateStats(game, net_controller) {
    document.getElementById("episode_nr").innerHTML = game.episode_nr
    document.getElementById("best_score").innerHTML = game.best_score
    if (game.avg_scores[0]) {
      document.getElementById("avg_score").innerHTML = game.avg_scores[0].toFixed(2) }
    document.getElementById("current_score").innerHTML = `Score: ${game.world.score}`
    document.getElementById("episodes_since_best").innerHTML = game.episodes_since_best
    document.getElementById("epsilon").value = net_controller.epsilon.toFixed(3)
    document.getElementById("eta").value = net_controller.eta
    document.getElementById("total_parameters").innerHTML = net_controller.total_parameters
    document.getElementById("total_neurons").innerHTML = net_controller.total_neurons
  }

  initGraph() {
    this.rendered_episode = null
    let ctx = this.context.graph

    let graph = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
            label: 'score',
            data: [],
            backgroundColor: [`rgba(${COOL_BLUE}, 0.2)`],
            borderColor: [`rgba(${COOL_BLUE}, 1)`],              
            borderWidth: 1,
            yAxisId: 'y'
          },{
            label: 'rolling average 100',
            data: [],
            backgroundColor: ['rgba(255, 255, 255, 0.2)'], // white
            borderColor: ['rgba(255, 255, 255, 1)'],              
            borderWidth: 1,
            yAxisId: 'y'
          },
          // {
          //   label: 'epsilon',
          //   data: [],
          //   backgroundColor: ['rgba(255, 150, 150, 0.2)'], // red
          //   borderColor: ['rgba(255, 150, 150, 1)'],              
          //   borderWidth: 1,
          //   yAxisId: 'y1'
          // },
        ]
      },
      options: {
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                drawBorder: false,
                color: function(context) {
                  if (context.tick.value == 0)
                    return 'black'
                  return 'rgb(0,0,0,.2)'
                },
              }                  
            },
            // y1: {
            //   beginAtZero: true,
            //   max: 1,
            //   position: 'right',
            //   grid: {
            //     drawOnChartArea: false, // The second scale shouldn't have a grid
            //   }                  
            // }
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

  updateGraph(game) {
    if (game.episode_nr == this.rendered_episode) return

    let labels = []
    for (let i in game.scores) {labels.push(parseInt(i)+1)}

    this.graph.data.labels = labels
    this.graph.data.datasets[0].data = game.scores.slice().reverse()
    this.graph.data.datasets[1].data = game.avg_scores.slice().reverse()
    // this.graph.data.datasets[2].data = game.epsilons.slice().reverse()
    this.graph.update()

    this.rendered_episode = game.episode_nr
  }

  drawWeights(weights, space=30) {
    if (!weights) return

    let ctx = this.buffer.weights

    ctx.canvas.height = this.context.nn.canvas.height
    ctx.canvas.width = this.context.nn.canvas.width

    ctx.clearRect(0,0,10000,10000)
    this.context.nn.clearRect(0,0,10000,10000) 

    let layer_height = (ctx.canvas.height-space)*.92/(weights.length-1) // *.92 to not go the edges
    let start_height = (ctx.canvas.height-space)*.04 // space is left for action labels at the bottom

    for (let l = 1; l < weights.length; l++) {
      let height = start_height + (l)*layer_height
      let prev_height = start_height + (l-1)*layer_height

      let layer = weights[l]
      let node_width = ctx.canvas.width/(layer.length)
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

  drawActivations(activations, actions, space=30) {
    let ctx = this.buffer.activations
    ctx.clearRect(0,0,10000,10000)
    // The context.nn is already cleared in drawWeights

    if (!activations) return

    ctx.canvas.height = this.context.nn.canvas.height
    ctx.canvas.width = this.context.nn.canvas.width

    let layer_height = (ctx.canvas.height-space)*.92/(activations.length-1) // *.92 to not go the edges
    let start_height = (ctx.canvas.height-space)*.04 // space is left for action labels at the bottom

    // Get max value of the output layer
    let last_layer = activations[activations.length-1]
    let max_value = 0
    let max_index = null
    for (let j in last_layer) {
      let value = last_layer[j]
      if (value > max_value) {
        max_value = value
        max_index = j
      }
    }
    for (let v in last_layer) { // normalize and square to make differences more apparent
      last_layer[v] /= max_value
      last_layer[v] *= last_layer[v]
    }

    // Draw activations
    for (let l = 0; l < activations.length; l++) {
      let height = start_height + l*layer_height

      let layer = activations[l]
      let node_width = ctx.canvas.width/(layer.length+1)
      let radius = node_width / 10

      for (let j in layer) {
        let x = (parseInt(j)+1)*node_width
        let value = layer[j]
        ctx.fillStyle = `rgb(255,255,255,${value})`
        if (value < 0) {
          ctx.fillStyle = `rgb(${COOL_BLUE},${-value})`
        }
        ctx.beginPath()
        ctx.ellipse(x, height, radius, radius, 0, 0, 7)
        ctx.fill()
      }
    }

    // Draw action labels
    let font_size = 10
    ctx.textAlign = 'center'
    ctx.font = `${font_size}px Arial`
    let l = activations.length-1
    let height = start_height + l*layer_height + space + font_size
    let layer = activations[l]
    let node_width = ctx.canvas.width/(layer.length+1)
    for (let j in layer) {
      ctx.fillStyle = 'white'
      if (j == max_index) ctx.fillStyle = `rgb(${COOL_BLUE})`
      let x = (parseInt(j)+1)*node_width
      let text = actions[j]
      ctx.fillText(text, x, height, node_width)
    }
  }  


  init(world) {
    let world_width = world.x_threshold * 2
    this.scale = world.width / world_width
    let cart_y = world.height - 40 // Top of cart (except it's not lol)

    this.buffer.cart.translate(world.width/2, cart_y)
  }

  drawWorld(world) {
    // this.buffer.cart.clearRect(-1000,-1000,2000,2000)
    // this.buffer.cart.fillStyle = "#ffffff";
    this.buffer.cart.clearRect(-1000,-1000,10000, 10000)
    this.context.cart.clearRect(-1000,-1000,10000, 10000)

    let pole_width = 10.0
    let pole_len = this.scale * (2*world.length)
    let cart_width = 50.0
    let cart_height = 30.0

    let top = -cart_height/2
    let left = -cart_width/2

    this.buffer.cart.fillStyle = this.color1;
    this.buffer.cart.translate(world.state.x*this.scale, 0)
      this.buffer.cart.fillRect(left, top, cart_width, cart_height)

      top = -pole_len + pole_width/2
      left = -pole_width/2
      let axle_offset = cart_height / 4.0

      this.buffer.cart.fillStyle = this.color2;
      this.buffer.cart.translate(0, -axle_offset)
        this.buffer.cart.rotate(world.state.theta)
          this.buffer.cart.fillRect(left, top, pole_width, pole_len)
        this.buffer.cart.rotate(-world.state.theta)

        this.buffer.cart.strokeStyle = "#000000"
        this.buffer.cart.lineWidth = 1
        this.buffer.cart.beginPath()
        this.buffer.cart.ellipse(0, 0, 2, 2, 0, 0, Math.PI*2)
        this.buffer.cart.stroke()
      this.buffer.cart.translate(0, axle_offset)
    this.buffer.cart.translate(-world.state.x*this.scale, 0)

  }

  resize(width, height, height_width_ratio) {

    if (height / width > height_width_ratio) {

      this.context.cart.canvas.height = width * height_width_ratio;
      this.context.cart.canvas.width = width;

    } else {

      this.context.cart.canvas.height = height;
      this.context.cart.canvas.width = height / height_width_ratio;

    }

    let content_div = document.getElementById("content_div")
    let graph_canvas = this.context.graph.canvas
    let nn_canvas = this.context.nn.canvas

    let graph_width = content_div.offsetWidth * .5
    let graph_height = content_div.offsetHeight - document.getElementById("content_top_div").offsetHeight
    if (this.graph) { 
      this.graph.destroy() 
      graph_canvas.height = graph_height
      graph_canvas.width = graph_width
      this.graph = this.initGraph()
      this.updateGraph(document.value.game)
    } else {
      graph_canvas.height = graph_height
      graph_canvas.width = graph_width
    }    

    nn_canvas.width = graph_width
    nn_canvas.height = graph_height    

    // this.context.cart.imageSmoothingEnabled = false;

  }

  render() { 
    this.context.cart.drawImage(this.buffer.cart.canvas, 0, 0, this.buffer.cart.canvas.width, this.buffer.cart.canvas.height, 0, 0, this.context.cart.canvas.width, this.context.cart.canvas.height);   
    this.context.nn.drawImage(this.buffer.weights.canvas, 0, 0, this.buffer.weights.canvas.width, this.buffer.weights.canvas.height, 0, 0, this.context.nn.canvas.width, this.context.nn.canvas.height);   
    this.context.nn.drawImage(this.buffer.activations.canvas, 0, 0, this.buffer.activations.canvas.width, this.buffer.activations.canvas.height, 0, 0, this.context.nn.canvas.width, this.context.nn.canvas.height);   
  }  

}