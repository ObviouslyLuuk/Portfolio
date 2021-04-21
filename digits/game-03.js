class Game {
  constructor(state="batch") {
    this.state = state

    this.got_epoch = null
    this.got_batch = null
    this.weights = [[[]]]
  }

  get_weights(nn) {
    if (this.got_batch == nn.epoch.batch_nr && this.got_epoch == nn.epoch_nr) return

    this.weights = nn.get_weights()

    this.got_batch = nn.epoch.batch_nr
    this.got_epoch = nn.epoch_nr
  }
}