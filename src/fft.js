////////////////COPYRIGHT DECLARATION//////////////////////
//////
////// COPYRIGHT GUANYU HE AND HAO WU, 2013
////// ALL THE FOLLOWING CODE IS PROTECTED BY THE COPYRIGHT
//////
////// THE CODE IN THIS FILE CANNOT BE REUSED OUTSIDE CIS565 GPU PROGRAMMING COURSE
////// IN UNIVERSITY OF PENNSYLVANIA UNLESS SPECIAL AUTHORIZATION.
//////
////// CONTACT INFO: heguanyu9037@gmail.com
//////                  wuhao1117@gmail.com
//////
////////////////FILE INFO ///////////////////////////////
//////
////// FAST FOURIER TRANSFORMATION
////// INITIALIZATION THE SPECTRUM TEXTURE
////// AND RELATED FRAME BUFFER
//////
////////////////////////////////////////////////////////////

var fftHorizontalProgram;
var fftVerticalProgram;

var spectrumFramebuffer;
var spectrumTextureA;
var spectrumTextureB;
var initialSpectrumTex;

var butterflyTextures;

var heightFieldTex;

var numFFTStages;

function initFFTHorizontalShader() {
    var vertexShader = getShader(gl, "vs_quad");
    var fragmentShader = getShader(gl, "fs_fftHorizontal");

    fftHorizontalProgram = gl.createProgram();
    gl.attachShader(fftHorizontalProgram, vertexShader);
    gl.attachShader(fftHorizontalProgram, fragmentShader);
    gl.linkProgram(fftHorizontalProgram);
    if (!gl.getProgramParameter(fftHorizontalProgram, gl.LINK_STATUS)) {
        alert("Could not initialise FFT Horizontal shader");
    }
 
    fftHorizontalProgram.vertexPositionAttribute = gl.getAttribLocation(fftHorizontalProgram, "position");

    fftHorizontalProgram.fftDataUniform = gl.getUniformLocation(fftHorizontalProgram, "u_fftData");
    fftHorizontalProgram.butterflyUniform = gl.getUniformLocation(fftHorizontalProgram, "u_butterflyData");

}

function initFFTVerticalShader() {
    var vertexShader = getShader(gl, "vs_quad");
    var fragmentShader = getShader(gl, "fs_fftVertical");

    fftVerticalProgram = gl.createProgram();
    gl.attachShader(fftVerticalProgram, vertexShader);
    gl.attachShader(fftVerticalProgram, fragmentShader);
    gl.linkProgram(fftVerticalProgram);
    if (!gl.getProgramParameter(fftVerticalProgram, gl.LINK_STATUS)) {
        alert("Could not initialise FFT Vertical shader");
    }
 
    fftVerticalProgram.vertexPositionAttribute = gl.getAttribLocation(fftVerticalProgram, "position");

    fftVerticalProgram.fftDataUniform = gl.getUniformLocation(fftVerticalProgram, "u_fftData");
    fftVerticalProgram.butterflyUniform = gl.getUniformLocation(fftVerticalProgram, "u_butterflyData");

}


function initFFTFramebuffer()
{
	spectrumFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, spectrumFramebuffer);
    spectrumFramebuffer.width = meshSize;
    spectrumFramebuffer.height = meshSize;
    
    spectrumTextureA = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, spectrumTextureA);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, spectrumFramebuffer.width, spectrumFramebuffer.height, 0, gl.RGBA, gl.FLOAT, null);
    
    spectrumTextureB = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, spectrumTextureB);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, spectrumFramebuffer.width, spectrumFramebuffer.height, 0, gl.RGBA, gl.FLOAT, null);
    
   
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, spectrumTextureA, 0);
    
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE");
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function bitReverse(x, numFFTStages)
{
	x = (((x & 0xaaaaaaaa) >> 1) | ((x & 0x55555555) << 1));
    x = (((x & 0xcccccccc) >> 2) | ((x & 0x33333333) << 2));
    x = (((x & 0xf0f0f0f0) >> 4) | ((x & 0x0f0f0f0f) << 4));
    x = (((x & 0xff00ff00) >> 8) | ((x & 0x00ff00ff) << 8));
    x = ((x >> 16) | (x << 16));
    x >>>= 32 - numFFTStages;
    return x;
}

function initButterflyTextures()
{
	// initialize butterfly indices and weights for every stage
	numFFTStages = Math.log(meshSize)/Math.LN2;
	var delta = 1.0/meshSize;
	butterflyTextures = new Array(numFFTStages);
	
	for(var n = 0; n < butterflyTextures.length; ++n)
	{
		var butterflyArray = new Float32Array(meshSize*meshSize*4);
		var k = 0, k0 = 0;
		var exp = Math.pow(2, numFFTStages - n - 1);
		var stepNext = Math.pow(2, n+1);
		var stepThis = 0.5*stepNext;
		// compute for the first row		
		for(var m = 0; m < stepThis; ++m) // loop through butterflies with different weights
		{
			k = m*4;
			for(var l = m; l < meshSize; l += stepNext, k += stepNext*4) // loop through butterflies with same weights
			{
				if(n != 0)
				{
					// indices for upper operand of butterfly
					butterflyArray[k]   = (l + 0.5)*delta ;   		  // index (stored as texture coordinates) of Source1
					butterflyArray[k+1] = (l + stepThis + 0.5)*delta;   // index (stored as texture coordinates) of Source2	
					// indices for lower operand of butterfly
					butterflyArray[k+stepThis*4]   = (l + 0.5)*delta ;   		  // index (stored as texture coordinates) of Source1
					butterflyArray[k+stepThis*4+1] = (l + stepThis + 0.5)*delta;   // index (stored as texture coordinates) of Source2	
				}
				else // scramble the index order for the first stage based on bit reversal
				{
					// indices for upper operand of butterfly
					butterflyArray[k]   = (bitReverse(l, numFFTStages)+ 0.5)*delta ;   		  // index (stored as texture coordinates) of Source1
					butterflyArray[k+1] = (bitReverse(l + stepThis, numFFTStages) + 0.5)*delta;   // index (stored as texture coordinates) of Source2			
					// indices for lower operand of butterfly
					butterflyArray[k+stepThis*4]   = (bitReverse(l, numFFTStages) + 0.5)*delta ;   		  // index (stored as texture coordinates) of Source1
					butterflyArray[k+stepThis*4+1] = (bitReverse(l + stepThis, numFFTStages) + 0.5)*delta;   // index (stored as texture coordinates) of Source2
				}						
			}
		}
		
		k = 2;
		for(var i = 0; i < meshSize; i++, k += 2) 
		{
			
			/*
			 *   Source1 ----------				- += Output1
			 * 			 			-		-	
			 * 			 				- 	
			 *  		    		-		-
			 *   Source2 * weight--				- += Output2
			 *   
			 * 	 For Source1, weight is stored as it is
			 * 	 For Source2, weight is stored as -weight
			 * 
			 */
			var r = (i * exp) % meshSize;		
			butterflyArray[k++] =  Math.cos(2*Math.PI*r/meshSize);   // real part of weight
			butterflyArray[k++] =  Math.sin(2*Math.PI*r/meshSize);   // imaginary part of weight
		}
		// copy the first row to every row
		k = 4*meshSize;
		for(var j = 1; j < meshSize; j++)
		{
			k0 = 0;
			for(var i = 0; i < meshSize; i++) 
			{
				butterflyArray[k++] = butterflyArray[k0++];   // index (stored as texture coordinates) of Source1
				butterflyArray[k++] = butterflyArray[k0++];   // index (stored as texture coordinates) of Source2
				butterflyArray[k++] = butterflyArray[k0++];   // real part of weight
				butterflyArray[k++] = butterflyArray[k0++];   // imaginary part of weight
			}
		}
		butterflyTextures[n] = gl.createTexture();
	    gl.bindTexture(gl.TEXTURE_2D, butterflyTextures[n]);
	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, meshSize, meshSize, 0, gl.RGBA, gl.FLOAT, butterflyArray);
	}

}

function executeFFTStage(sourceData, butterflyData, framebuffer)
{
	

}