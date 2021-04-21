export function sigmoid(z) {
    return 1/(1 + Math.exp(-z))
}

export function sigmoid_prime(z) {
    return sigmoid(z) * (1 - sigmoid(z))
}

export function ReLU(z) {
    if (z > 0)
        return z
    return 0
}

export function ReLU_prime(z) {
    if (z > 0)
        return 1
    return 0
}