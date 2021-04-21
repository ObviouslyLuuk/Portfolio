
var rand_counter = 0

export function seeded_rand(seed=0, min=-.5) {
    /** Inspired by: https://gist.github.com/blixt/f17b47c62508be59987b */
    seed += rand_counter
    let rand = seed * 16807 % 0xFFFF
    rand_counter++
    return rand / 0xFFFF + min   // range between -0.5 and 0.5
}

export function rand_matrix(d1, d2, seed=0) {
    let matrix = []
    let rand_counter = 0
    for (let i = 0; i < d1; i++) {
        if (d2 == 1) {
            matrix.push(seeded_rand(seed + rand_counter))
            rand_counter += 1
        }
        else {
            matrix.push([])
            for (let j = 0; j < d2; j++) {
                matrix[i].push(seeded_rand(seed + rand_counter))
                rand_counter += 1
            }            
        }
    }
    return matrix
}
