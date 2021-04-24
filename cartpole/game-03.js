class Game {
  constructor() {
    this.world = new Game.World(this)

    this.state = 'train' // can be train, drive

    // Settings
    this.printing = false
    this.max_steps = 500
    // this.auto_set_best = 15
    this.auto_adjust_eta = true
    // this.auto_adjust_epsilon = 2 // 2    

    // Trackers
    this.episode_nr = 0
    this.best_score = -Infinity
    this.scores = []
    this.avg_scores = []
    this.epsilons = []
    this.episodes_since_best = 0

    this.params = null
    this.best_params = null
    this.last_set_to_best = 0

    this.got_batch = null
    this.weights = [[[]]]
  }

  set_default_settings() {
    let net_controller = document.value.net_controller
    net_controller.eta = .001
    net_controller.epsilon = 1
    net_controller.epsilon_decay = .95
    net_controller.gamma = 1
    net_controller.batch_size = 64
    net_controller.change_buffer_size(50000)
    net_controller.double_dqn = true
    net_controller.target_update_time = 500

    this.state = 'train'

    this.printing = false
    this.max_steps = 500
    // this.auto_set_best = 15
    this.auto_adjust_eta = true
    // this.auto_adjust_epsilon = 2

    this.reset()
    document.value.controller.settings_update_values()
  }

  load_best() {
    let net_controller = document.value.net_controller
    // net_controller.change_design(BEST_PARAMS.layer_design) // TODO
    net_controller.set_params(BEST_PARAMS.layer_design, BEST_PARAMS.parameters)
    net_controller.epsilon = 0
    net_controller.eta = 0

    this.printing = false
    this.max_steps = Infinity
    this.auto_set_best = Infinity
    this.auto_ajust_eta = Infinity
    this.auto_ajust_epsilon = Infinity

    this.last_set_to_best = 0    
    document.value.controller.settings_update_values()
  }

  set_best() {
    document.value.net_controller.reset()
    document.value.net_controller.set_params(this.best_params.layer_design, this.best_params.parameters)
    this.last_set_to_best = 0
  }  

  get_weights(nn) {
    if (this.got_batch == nn.target_update_timer) return

    this.weights = nn.get_weights()

    this.got_batch = nn.target_update_timer
  }  

  update() {

    this.world.update()

  }

  finish_episode() {
    this.episode_nr++

    this.scores.unshift(this.world.score)

    this.episodes_since_best++
    if (this.world.score >= this.best_score) { // >= because a later equal score likely has better params
      this.best_score = this.world.score
      this.episodes_since_best = 0
      this.best_params = this.params
    }

    // Get average score over the past 100 episodes
    let average = 0
    for (let s = 0; s < 100 && this.scores[s] != undefined; s++) {
      let score = this.scores[s]
      average += score
    }
    average /= Math.min(this.scores.length, 100)
    this.avg_scores.unshift(average)

    // Add current epsilon to list for graph display
    this.epsilons.unshift(document.value.net_controller.epsilon)

    this.reset()

    this.last_set_to_best++
  }  

  reset() {
    this.world.reset()
    this.params = document.value.net_controller.get_params()
  }
}

/* https://github.com/openai/gym/blob/master/gym/envs/classic_control/cartpole.py#L75 */
Game.World = class {
  constructor(game) {
    this.game = game

    this.gravity          = 9.8
    this.masscart         = 1.0
    this.masspole         = .1
    this.total_mass       = this.masscart + this.masspole
    this.length           = .5 // half of the pole's length
    this.polemass_length  = this.masspole * this.length
    this.force_mag        = 10.0
    this.tau              = .02 // seconds between state updates
    this.kinematics_integrator = 'euler'

    // Angle at which to fail the episode
    this.theta_threshold_radians  = 12 * 2*Math.PI/360
    this.x_threshold              = 2.4

    this.state = {
      x:          null,
      x_dot:      null,
      theta:      null,
      theta_dot:  null,
    }

    this.steps_beyond_done = null

    this.score = 0
    this.done = false
    
    this.width = 600
    this.height = 200

  }

  update(action) {

    let x =         this.state.x 
    let x_dot =     this.state.x_dot
    let theta =     this.state.theta
    let theta_dot = this.state.theta_dot

    let force
    if (action == "moveRight") {
      force =  this.force_mag
    } else if (action == "moveLeft") {
      force = -this.force_mag
    } else { // Personal addition by me to enable player-driving
      force = 0
    }
    let costheta = Math.cos(theta)
    let sintheta = Math.sin(theta)

    // For the interested reader:
    // https://coneural.org/florian/papers/05_cart_pole.pdf
    let temp = (force + this.polemass_length * Math.pow(theta_dot,2) * sintheta) / this.total_mass
    let thetaacc = (this.gravity * sintheta - costheta * temp) / (this.length * (4.0 / 3.0 - this.masspole * Math.pow(costheta,2) / this.total_mass))
    let xacc = temp - this.polemass_length * thetaacc * costheta / this.total_mass

    if (this.kinematics_integrator == 'euler') {
      x =         x         + this.tau * x_dot
      x_dot =     x_dot     + this.tau * xacc
      theta =     theta     + this.tau * theta_dot
      theta_dot = theta_dot + this.tau * thetaacc
    } else { // semi-implicit euler
      x_dot =     x_dot     + this.tau * xacc
      x =         x         + this.tau * x_dot
      theta_dot = theta_dot + this.tau * thetaacc
      theta =     theta     + this.tau * theta_dot
    }

    this.state = {
      x:          x,
      x_dot:      x_dot,
      theta:      theta,
      theta_dot:  theta_dot,       
    }

    let done = (
      x     < -this.x_threshold             ||
      x     >  this.x_threshold             ||
      theta < -this.theta_threshold_radians ||
      theta >  this.theta_threshold_radians ||
      this.score+1 >= this.game.max_steps
    )

    let reward
    if (!done) {
      reward = 1.0
    } else if (this.steps_beyond_done == null) {
      // Pole just fell!
      this.steps_beyond_done = 0
      reward = 1.0
    } else {
      if (this.steps_beyond_done == 0 && this.game.printing) {
        console.log("You are calling 'step()' even though this environment has already returned done = True. You should always call 'reset()' once you receive 'done = True' -- any further steps are undefined behavior.")
      }
      this.steps_beyond_done++
      reward = 0.0
    }

    this.score += reward
    this.done = done

    return {
      state:  this.state, 
      reward: reward, 
      done:   done
    }

  }

  reset() {
    this.state = {
      x:          (Math.random()-0.5)/10,
      x_dot:      (Math.random()-0.5)/10,
      theta:      (Math.random()-0.5)/10,
      theta_dot:  (Math.random()-0.5)/10,      
    }
    this.steps_beyond_done = null
    this.score = 0
    this.done = false
    return this.state
  }

}

const BEST_PARAMS = JSON.parse(`
{
  "layer_design": [
      4,
      16,
      2
  ],
  "parameters": [
      {},
      {
          "biases": [
              8.533775196276327,
              4.01634057612759,
              3.1076590134040294,
              1.4501871993468647,
              -8.023924146127019,
              2.846417782954847,
              0.07360757516233725,
              -3.125468803453354,
              4.946425826820902,
              2.1186406354425023,
              -2.3563481621403275,
              5.600685029998045,
              5.209862742231267,
              3.7937093217457725,
              2.003625212144399,
              -1.8138784863700692
          ],
          "weights": [
              [
                  0.4230935667178865,
                  -0.0743071017339308,
                  3.4596939977134773,
                  4.9560666957258395
              ],
              [
                  -1.0538181071552535,
                  0.10911561009249739,
                  -0.28971269526289434,
                  0.07679356830841154
              ],
              [
                  0.054434123037538085,
                  1.250140095746419,
                  0.19513685773017794,
                  -2.4165088271384847
              ],
              [
                  -0.8240691648939148,
                  1.4833718774668199,
                  2.85036187352959,
                  6.2282665254421605
              ],
              [
                  -0.3215191917694123,
                  2.1615743189814007,
                  -3.000951555586858,
                  -5.3805853752566355
              ],
              [
                  -0.4252190878487423,
                  0.43663322370351887,
                  1.840758207438294,
                  1.7439480576185902
              ],
              [
                  0.8564317680173289,
                  4.423104347014352,
                  11.235894431623498,
                  3.195890258744482
              ],
              [
                  0.46020580616380596,
                  -0.9662955904305773,
                  -6.089149813309398,
                  -4.721765183292652
              ],
              [
                  -0.1887142196804417,
                  2.711187134231597,
                  5.281435858387881,
                  4.294319991095868
              ],
              [
                  -0.057084091770892034,
                  1.460051986946057,
                  0.6165967693333669,
                  -1.4001065438787552
              ],
              [
                  -0.8065484958246951,
                  0.6704694923624565,
                  4.105113680975012,
                  4.706541160468928
              ],
              [
                  0.546332674646471,
                  0.643371107710731,
                  2.368696054688609,
                  1.3755093937691578
              ],
              [
                  0.10608993621399868,
                  0.8651710690397719,
                  0.5993314982976504,
                  -1.7680585365137649
              ],
              [
                  -0.10801305806335738,
                  0.871769187047958,
                  2.4440970451225215,
                  0.5325965528006197
              ],
              [
                  -0.12862348377489388,
                  1.4663125471701766,
                  0.9881338882386893,
                  -1.7105354802480401
              ],
              [
                  -0.06828921696069018,
                  0.5365226853804766,
                  -0.6194008081762572,
                  -1.2383733310729228
              ],
              []
          ]
      },
      {
          "biases": [
              1.2796173393482553,
              3.0249278382927067
          ],
          "weights": [
              [
                  7.889637706644364,
                  -2.561543691292861,
                  2.741489662843375,
                  -6.333402132880498,
                  9.102864729776334,
                  2.9427330513430574,
                  -6.536149193252116,
                  2.0121513840741,
                  6.530113779746275,
                  2.0264831529851453,
                  -5.108259489243547,
                  -2.216999500970325,
                  1.635545904044935,
                  -0.5833828028822357,
                  2.2658097855317654,
                  2.078100621812314
              ],
              [
                  4.140018333351913,
                  -2.9789596978979986,
                  2.290346840708402,
                  -0.8782162064887667,
                  -2.8793839089069433,
                  1.0233442975947606,
                  -6.753372350070613,
                  -7.460834983780046,
                  1.3300598234718861,
                  1.4778294946482897,
                  -3.9844198349725617,
                  3.8141709170019964,
                  4.5094935509175835,
                  2.4634252582918004,
                  0.9540751247917618,
                  -0.6892989071615947
              ],
              []
          ]
      }
  ]
}
`)