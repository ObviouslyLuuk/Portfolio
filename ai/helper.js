export function get_max_value_index(list) {
    /** Returns the index of the max value */
    let max = 0
    let max_index = 0
    for (let index in list) {
        if (list[index] > max) {
            max = list[index]
            max_index = index
        }
    }
    return parseInt(max_index)
}