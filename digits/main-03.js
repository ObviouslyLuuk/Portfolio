// Credit for the idea of the organization for this file, and the code for the engine, goes to Frank Poth 03/23/2017

window.addEventListener("load", function(event) {

  "use strict";

    ///////////////////
   //// FUNCTIONS ////
  ///////////////////

  var resize = function(event) {

    display.resize(document.getElementById("content_div").offsetWidth, document.getElementById("content_div").offsetHeight, 9/16);
    display.render();

  };

  var render = function() {

    display.updateStats(nn)
    display.updateGraph(nn)

    display.drawInput(step_example_res.x)
    display.drawLabels(step_example_res.y, step_example_res.label, step_example_res.prediction)

    game.get_weights(nn)
    display.drawWeights(game.weights)
    display.drawActivations(step_example_res.activations)

    // TODO: maybe visualize which input pixels have the strongest effect on a certain neuron when hovering over it
        
    display.render()    

  }

  var update = function() {
    if (engine.slowmo) {
      engine.setSlowMo(false)
    } else if (step_example_res.correct == false && game.state != "draw") {
      engine.setSlowMo()
      return
    }

    step_example_res = {x: null, y: [0,0,0,0,0,0,0,0,0,0], activations: null, correct: null, label: null, prediction: null}    

    switch (game.state) {
      case "draw":
        let image_data = display.buffer.input.getImageData(0,0,28,28).data
        let image = [] // This will be B&W and normalized
        for (let i = 0; i < image_data.length; i += 4) {
          image.push(image_data[i]/255)
        }
        step_example_res.activations = nn.test_example(image)
        break
      
      case "epoch":
        nn.epoch.step_epoch()
        break

      case "batch":
        nn.epoch.step_batch()
        break

      case "example":
        step_example_res = nn.epoch.step_example()
        break
    
      default:
        break
    }
  }

    /////////////////
   //// OBJECTS ////
  /////////////////

  var display    = new Display()
  var controller = new Controller()
  var engine     = new Engine(1000/25, render, update)
  var nn         = new NeuralNet(undefined, [{type:"Dense",size:16}])
  var game       = new Game("epoch")

  document.value = {
    game: game, 
    controller: controller,
    display: display,
    nn: nn,
    engine: engine,
  }

  var step_example_res = {x: null, y: [0,0,0,0,0,0,0,0,0,0], activations: null, correct: null, label: null, prediction: null}

    ////////////////////
   //// INITIALIZE ////
  ////////////////////

  display.buffer.input.canvas.height = 28
  display.buffer.input.canvas.width  = 28

  resize()
  controller.init_buttons(game)
  controller.init_draw(display.canvas.input)
  display.graph = display.initGraph()

  engine.start()

  window.addEventListener("resize",  resize)

});
