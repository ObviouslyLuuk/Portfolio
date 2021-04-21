// Frank Poth 03/23/2018

class Game {
  constructor() {

    this.state = 'train' // can be train, drive

    this.world = new Game.World()

    this.episode_nr = 0
    this.best_score = -Infinity
    this.scores = []
    this.avg_scores = []
    this.epsilons = []
    this.episodes_since_best = 0

    this.got_batch = null
    this.weights = [[[]]]    
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
    if (this.world.score > this.best_score) {
      this.best_score = this.world.score
      this.episodes_since_best = 0
    }

    // Get average score over the past 100 episodes
    let average = 0
    for (let s = 0; s < 100 && this.scores[s]; s++) {
      let score = this.scores[s]
      average += score
    }
    average /= Math.min(this.scores.length, 100)
    this.avg_scores.unshift(average)

    // Add current epsilon to list for graph display
    this.epsilons.unshift(document.value.net_controller.epsilon)

    this.reset()

    // TODO: save params at start of every episode and then if that episode turns out to be a high score set those params as the best params so far (and save in file?)
  }  

  reset() {
    this.world.reset()
  }
}

/* https://github.com/openai/gym/blob/master/gym/envs/classic_control/cartpole.py#L75 */
Game.World = class {
  constructor() {

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

    // Angle limit set to 2 * theta_threshold_radians so failing observation is still within bounds
    // unnecessary code?
    // ------------------

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

  };

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
    } else {
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
      theta >  this.theta_threshold_radians
    )

    let reward
    if (!done) {
      reward = 1.0
    } else if (this.steps_beyond_done == null) {
      // Pole just fell!
      this.steps_beyond_done = 0
      reward = 1.0
    } else {
      if (this.steps_beyond_done == 0) {
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