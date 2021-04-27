Credit for the file organization and the real time JavaScript engine goes to Frank Poth https://youtu.be/w-OKdSHRlfA.
For other credits see credits.md

# AI Projects
Since last summer I've been learning about AI and testing my understanding by coding little projects with neural networks from scratch. I tried to make the projects as visual and interactive as possible so others can engage with the material like I did.

Play with the projects for yourself [here](https://obviouslyluuk.github.io/Portfolio)

## Recognizing MNIST digits
In the first project I trained a neural network to recognize handwritten digits from the famous MNIST dataset. The most exciting bit is that you can draw your own digits and see how the network activations change. In other words, you can see how the network "thinks" in real time.

<!-- https://richardstudynotes.blogspot.com/2014/04/link-images-stored-in-google-drive-to.html -->
![Drawing a digit](https://drive.google.com/uc?id=1xGccUN7Jr0zzuCXP8E8xuW45fqLX5hlO)
*Network activations changing whilst drawing a digit.*

I also added the ability to drag your digits around to see how that changes the network's prediction. This has a significant effect on whether the digit is correctly identified.

![Moving a digit](https://drive.google.com/uc?id=16ZL2lqYUgPMQYB6xVDZd3bpQGwjMGZ6v)
*Network activations changing whilst moving a digit.*

## OpenAI Gym cartpole
In the second project I tackled the well known environment where a cart has to balance a pole by moving left or right. 

![Cartpole balancing](https://drive.google.com/uc?id=1cUWwA_Hp71pzx8S6JFJbS5KNrHJezXg2)
*The white cart trying to balance the blue pole.*

I chose to use a Double DQN, reusing the previous neural network as policy and target network. With the right parameters it can solve the environment in around 150 episodes (meaning: it achieves a rolling average of 195.0 over a hundred episodes), which translates to a few minutes depending on your hardware.
Larger networks like the one you see below were prone to exploding gradients so I chose a network with one hidden layer of 16 neurons.

![Exploding gradients in cartpole](https://drive.google.com/uc?id=168la_1JjPrXqQ70SFRdq8xgSyJTPWWjt)
*Exploding gradients visualized in the cartpole project.*

## CodeBullet inspired racer
For the third project I wanted to stick with reinforcement learning and was inspired by [CodeBullet](https://www.youtube.com/watch?v=r428O_CMcpI). I wanted to test my DDQN on something more complicated than cartpole and saw the racing idea as a fun way to make it interactive.

I added the feature of drawing your own tracks and letting the racer train on them. Alternatively you can click on the "Info" button and select "Load Best Parameters" to see the trained model try your track. Do note that this last option turns off learning so you'll have to go back to the default settings to let it learn from there.

![Drawing a new track](https://drive.google.com/uc?id=1Hy0DRZTB_t9MSS_qg4ejoCzFrnNjN_uB)
*Drawing a new racetrack and testing the trained network on it.*

