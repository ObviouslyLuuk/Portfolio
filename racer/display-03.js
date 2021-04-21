const COOL_GREEN = '99, 255, 132'
const COOL_BLUE = '0, 115, 255'

class Display {
  constructor() {

    this.init_elements()

    this.buffer  = {
      map:          document.createElement("canvas").getContext("2d"),
      car:          document.createElement("canvas").getContext("2d"),
      weights:      document.createElement("canvas").getContext("2d"),
      activations:  document.createElement("canvas").getContext("2d"),
    }

    this.context = {
      map: document.getElementById("map_canvas").getContext("2d"),
      car: document.getElementById("car_canvas").getContext("2d"),
      nn: document.getElementById("nn_canvas").getContext("2d"),
      graph: document.getElementById("graph_canvas").getContext("2d"),
    } 

    this.graph = null
    this.rendered_episode = null

  }

  init_elements() {
    document.body.style.color = 'white'
    document.body.style.display = 'grid'
    document.body.style.position = 'relative'
    document.body.style['align-items'] = 'center'

    let innerHTML = `
    <div id="content_wrapper" style="width:100%;height:100%;position:absolute;padding:10px">
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
            <button id="settings_btn" class="btn">Info</button>
            <button id="reset_btn" class="btn">Reset</button>
            <button id="save_btn" class="btn">Save</button>
            <input id="load_btn" type="file" name="files[]" style="display:none;">
            <label for="load_btn" class="btn btn-light" style="margin: 0;">Load</label> 
          </div>
        </div>
        <div id="content_top_right_div">
          <div id="content_top_right_canvas_div" style="position: relative; margin-top:5px">
            <div id="current_score" style="position:absolute; padding-inline: 5px;">Score: 0</div>
            <canvas id="map_canvas" style="width:100%; position: absolute; border: 2px solid grey; border-radius: 5px; image-rendering: auto;"></canvas>
            <canvas id="car_canvas" style="width:100%; image-rendering: auto;"></canvas>
          </div>
          <div id="content_top_right_bar_div" style="display: grid; grid-template-columns: auto auto auto; column-gap:5px;">
            <button id="drive_btn" class="btn">Drive</button>
            <div id="draw_dropdown">
              <button id="draw_btn" class="btn" style="width:100%;">Draw</button>
              <div id="draw_hover_div" style="display:none; position: absolute;z-index:1;">
                <button id="draw_wall_btn" class="btn" style="border-radius:0px;">Border</button>
                <button id="draw_target_btn" class="btn" style="border-radius:0px;">Target</button>
                <button id="draw_car_btn" class="btn" style="border-radius:0px;">Car</button>
              </div>
            </div>
            <div id="draw_buttons_div" style="display:none; grid-template-columns:auto auto auto; column-gap:5px;">
              <button id="clear_btn" class="btn">Clear</button>
              <button id="save_map_btn" class="btn">Save</button>
              <input id="load_map_btn" type="file" name="files[]" style="display:none;">
              <label for="load_map_btn" class="btn btn-light" style="margin: 0;">Load</label> 
            </div>
            <button id="default_map_btn" class="btn">Tracks</button>            
          </div>
        </div>
      </div>
      <div id="content_bottom_div" style="height:100%;display: grid; grid-template-columns: 50% 50%;">
        <div id="graph_canvas_div" style="display:grid"><canvas id="graph_canvas"></canvas></div>
        <div id="nn_canvas_div" style="display:grid"><canvas id="nn_canvas" style="image-rendering: auto;"></canvas></div>
      </div>
    </div>
    </div>
    `

    let info = `
    In this project the little red car is supposed to learn how to drive around the track without hitting the edges. 
    It attempts this by using a Double Deep Q-Network (DDQN), which updates neural network weights and biases based on experience replay. 
    The main neural network is the policy network; it accepts input from the car (Speed, and Distance to the edges in 6 directions) 
    and gives a Q-value (the total expected future reward) for each possible policy (Left, Right or Forward) it can take. 
    The car then takes the decision with the highest value, or a completely random one, where epsilon (exploration rate) 
    is the probability it does something random. The experience from every timestep, consisting of the input state, action, 
    resulting state and reward, is saved into a memory replay buffer. At every timestep a random batch is taken from this replay buffer, 
    on which we run Stochastic Gradient Descent (see the digits project for a more detailed description).
    The updates to the weights and biases are scaled using the learning rate eta (sometimes called alpha).
    <br> What makes a DQN a Double DQN is the addition of a target network.
    `

    let settings = `
    <div data-simplebar style="background-color: rgb(0,0,0,.95);width: 90%;height: 90%;border-radius: 20px;z-index: 1;position:absolute;justify-content: center;padding: 30px;">
      <a id="close_settings_btn" class="btn" style="position: absolute;right: 5px;top: 0px;">x</a>
      <div style="border-radius:5px;display: grid;width: 100%;padding: 5px;background-color:rgb(255,255,255,.2);">
        <h2 style="justify-self: center;">Settings</h2>
        <div><input type="checkbox" id="1"> <label for="1">Option1</label></div>
      </div>
      <br>
      <h2>Info</h2>
      <p>${info}</p>
       
    </div>
    `

    document.body.insertAdjacentHTML('beforeend', innerHTML)
    document.body.insertAdjacentHTML('beforeend', settings)
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

  drawWeights(weights, space=15) {
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

  drawActivations(activations, actions, space=15) {
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
        if (value < 0) ctx.fillStyle = `rgb(${COOL_BLUE},${-value})`
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
    let height = start_height + l*layer_height + space + font_size/2
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

  drawMap(map) {
    this.buffer.map.clearRect(0,0,10000,10000)
    this.context.map.clearRect(0,0,10000,10000)

    this.buffer.map.lineWidth = 5

    for (let mapObjectLists of Object.entries(map) ) {
      let object_name = mapObjectLists[0]
      let object_list = mapObjectLists[1]
      let color
      switch(object_name) {
        case "targets": color = `rgb(${COOL_BLUE})`; break;
        case "walls":   color = "white"; break;
      }
      this.buffer.map.strokeStyle = color

      for (let object of object_list) {
        if (object.timeout > 0) continue;
        let p0 = object.start
        let p1 = object.end
        this.buffer.map.beginPath()
        this.buffer.map.moveTo(p0.x, p0.y)
        this.buffer.map.lineTo(p1.x, p1.y)
        this.buffer.map.stroke() 
      }
    }

    let game = document.value.game
    if (game.state == "draw") {
      let draw_type = document.value.controller.draw_type

      let color
      switch(draw_type) {
        case "wall": color = 'white'
          break
        case "target": color = `rgb(${COOL_BLUE})`
          break
        case "car": color = 'red'
          break      
        default: color = 'white'                
      }

      if (game.world.added_segment[draw_type]) {
        let p0 = game.world.added_segment[draw_type]
        let p1 = document.value.controller.position

        this.buffer.map.strokeStyle = color
        this.buffer.map.beginPath()
        this.buffer.map.moveTo(p0.x, p0.y)
        this.buffer.map.lineTo(p1.x, p1.y)
        this.buffer.map.stroke()
      } else {
        let p1 = document.value.controller.position

        this.buffer.map.fillStyle = color
        this.buffer.map.beginPath()
        let radius = this.buffer.map.lineWidth
        this.buffer.map.ellipse(p1.x, p1.y, radius, radius, 0, 0, 7)
        this.buffer.map.fill()        
      }
    }

  }

  drawPlayer(rectangle, color1, color2, draw_sensors=true, draw_borders=false) {

    this.buffer.car.clearRect(0,0,2000,2000)
    this.context.car.clearRect(0,0,10000,10000)

    // Draw lines and dots for the sensors
    if (draw_sensors) {
      let corners = rectangle.getCorners()
      this.buffer.car.strokeStyle = 'rgb(0,0,0,.5)'
      this.buffer.car.fillStyle = 'rgb(0,0,0,.5)'
  
      for (let corner_sensor of Object.entries(rectangle.sensors) ) {
        let corner_name = corner_sensor[0]
        let sensor = corner_sensor[1]
  
        let corner = corners[corner_name]
  
        // Loop through the different directions of the sensor (straight and side)
        for (let p of Object.values(sensor) ) { 
          if (!p.x || !p.enabled) continue;
          this.buffer.car.beginPath()
          this.buffer.car.moveTo(corner.x, corner.y)
          this.buffer.car.lineTo(p.x, p.y)
          this.buffer.car.lineWidth = 2
          this.buffer.car.stroke()
          this.buffer.car.beginPath()
          this.buffer.car.ellipse(p.x, p.y, 3, 3, 0, 0, 7)
          this.buffer.car.fill()
        }
      }
    }

    this.buffer.car.strokeStyle = color1

    // Draw borders of the car
    if (draw_borders) {
      for (let points of Object.values(rectangle.getBorders()) ) {
        let p0 = points[0]
        let p1 = points[1]
        this.buffer.car.beginPath()
        this.buffer.car.moveTo(p0.x, p0.y)
        this.buffer.car.lineTo(p1.x, p1.y)
        this.buffer.car.stroke()
      }    
    }

    this.buffer.car.fillStyle = color1;

    // Draw filled shape of the car
    let cx = rectangle.getCx()
    let cy = rectangle.getCy()
    this.buffer.car.translate(cx, cy)
    this.buffer.car.rotate(rectangle.direction)
    this.buffer.car.fillRect(-rectangle.height/2, -rectangle.width/2, rectangle.height, rectangle.width);
    this.buffer.car.rotate(-rectangle.direction)
    this.buffer.car.translate(-cx, -cy)

  }

  resize(width, height, height_width_ratio) {

    let content_div = document.getElementById("content_div")
    let graph_canvas = this.context.graph.canvas
    let graph_canvas_div = graph_canvas.parentElement
    let nn_canvas = this.context.nn.canvas
    let nn_canvas_div = nn_canvas.parentElement

    let content_bottom_div = document.getElementById("content_bottom_div")
    let content_top_left_div = document.getElementById("content_top_left_div")

    if (height/width > 1/1.6) { // narrow/square screen
      if (graph_canvas_div.parentElement == content_top_left_div) {
        content_top_left_div.removeChild(graph_canvas_div)
        content_top_left_div.removeChild(nn_canvas_div)
        content_bottom_div.prepend(nn_canvas_div)
        content_bottom_div.prepend(graph_canvas_div)

        let content_top_right_bar_div = document.getElementById("content_top_right_bar_div")
        let content_top_right_div = document.getElementById("content_top_right_div")        
        content_top_right_div.removeChild(content_top_right_bar_div)
        content_top_right_div.appendChild(content_top_right_bar_div)        
      }

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
    } else {
      if (graph_canvas_div.parentElement == content_bottom_div) {
        content_bottom_div.removeChild(graph_canvas_div)
        content_bottom_div.removeChild(nn_canvas_div)
        content_top_left_div.prepend(nn_canvas_div)
        content_top_left_div.prepend(graph_canvas_div)

        let content_top_right_bar_div = document.getElementById("content_top_right_bar_div")
        let content_top_right_div = document.getElementById("content_top_right_div")        
        content_top_right_div.removeChild(content_top_right_bar_div)
        content_top_right_div.prepend(content_top_right_bar_div)
      }

      let graph_width = content_div.offsetWidth - this.context.map.canvas.offsetWidth - 5
      let other_height =  document.getElementById("table_div").offsetHeight +
                          document.getElementById("speed_div").offsetHeight +
                          document.getElementById("content_top_left_bar_div").offsetHeight +5
      let graph_height = (content_div.offsetHeight - other_height) * .5
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

    }

    // if (height / width > height_width_ratio) {

    //   this.context.map.canvas.height = width * height_width_ratio;
    //   this.context.map.canvas.width = width;

    // } else {

    //   this.context.map.canvas.height = height;
    //   this.context.map.canvas.width = height / height_width_ratio;

    // }

    // this.context.map.imageSmoothingEnabled = false;

  }

  render() { 
    this.context.map.drawImage(this.buffer.map.canvas, 0, 0, this.buffer.map.canvas.width, this.buffer.map.canvas.height, 0, 0, this.context.map.canvas.width, this.context.map.canvas.height); 
    this.context.car.drawImage(this.buffer.car.canvas, 0, 0, this.buffer.car.canvas.width, this.buffer.car.canvas.height, 0, 0, this.context.car.canvas.width, this.context.car.canvas.height);   
    this.context.nn.drawImage(this.buffer.weights.canvas, 0, 0, this.buffer.weights.canvas.width, this.buffer.weights.canvas.height, 0, 0, this.context.nn.canvas.width, this.context.nn.canvas.height);   
    this.context.nn.drawImage(this.buffer.activations.canvas, 0, 0, this.buffer.activations.canvas.width, this.buffer.activations.canvas.height, 0, 0, this.context.nn.canvas.width, this.context.nn.canvas.height);   
  }  

}