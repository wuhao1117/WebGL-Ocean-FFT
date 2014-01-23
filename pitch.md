----------------------------------------
Final Project Pitch                    
----------------------------------------
Guanyu He, Hao Wu
------

In this project, we are going to render a water shader on WebGL platform. This will include 2 parts: one for simulating the water and another for shading the water. To be specific, we would like to shade it as an ocean, or else, an ocean shader. As there is not an ocean shader currently on WebGL, our work will be the first one.

For the simulation part, the basic idea is simple. We will model the water surface as a 2D grid plane, and then simulate the height field of the grid, according to the time, volume conservation and the force fields (wind, gravity, turbulence, etc.) to simulate the height of each grid point, according to the information of the grids around it. 
The reference note is here(http://dl.acm.org/citation.cfm?id=1281681)
Reference work: an existing water shader. (http://madebyevan.com/webgl-water/)

For the shader part, we will use ray-tracing as our rendering method. Reflection and refraction will be supported, and maybe some complex BRDF models if possible. Also, we will add different skyboxes and suns(dawn, twilight, etc) to make the result look like a real ocean view.

One of the tricky parts that we have come across in our previous research is that we find some problem in writing the height field data to a texture for future use(similar to the idea of deferred shading, but WebGL does not seem to have such feature). We have searched online and found some solutions for this dilemma, which hopefully can solve this problem in our work.

If we got plenty of time after the above part done, we still have plan B: introducing oceanographic method to simulate a more realistic height field. 
http://www.edxgraphics.com/2/post/2011/09/simulating-ocean-waves-with-fft-on-gpu.html

As this method is really complicated as well as required more features than WebGL may provide, we will leave it as an extra feature.

Another extra feature that we may provide if having time is that let the ocean wave rock with the input music. As both music and ocean can be described as a frequency wave, it is also possible to implement this feature, but just need to figure out how to input and sampling the audio data.

