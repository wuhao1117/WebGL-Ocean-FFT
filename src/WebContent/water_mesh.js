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
////// THIS IS THE MAIN FILE OF THE WATER RENDERING
////// INCLUDING
////// THE INITIALIZATION OF THE 3 PASSES IN RENDERING
////// SIMULATION AND RENDERING THE OCEAN PATCHES
////// MOUSE AND KEYBOARD CONTROL
//////
////////////////////////////////////////////////////////////

var gl;
var meshSize = 512;         // grid resolution in both direction
var lowresSizes=[128,32,2];
var patchYOffset;
var patchSize = 100;        // grid size in meters
var scalar;                 // the draw size of the patch

var canvas = document.getElementById("canvas");	

var stats;
var startTime;
var currentTime = 0.0;
var totalFrames;

var canvasHeight;
var canvasWidth;

var quadPositionBuffer;
var quadIndicesBuffer;

var oceanPatchPositionBuffer;
var oceanPatchTexCoordBuffer;
var oceanPatchIndicesBuffer;

var oceanPatchPositionBuffer_Low;
var oceanPatchTexCoordBuffer_Low;
var oceanPatchIndicesBuffer_Low;

var simProgram;
var shaderProgram;
var shaderProgram_lowres;

var model;

var sun_azimuth;
var sun_zenith;
var sunPos = [0.0,-10.0,1800.0];
//var oceanColor = [0.12,0.36,0.48];
var oceanColor = [0,105/255.0,148/255.0];

/////////////////////////////////////////mouse control//////////////////////////////////
var mouseLeftDown = false;
var mouseRightDown = false;
var lastMouseX = null;
var lastMouseY = null;

/////////////////////////
//// camera information
/////////////////////////
var azimuth;
var zenith;

var center = [0.0, 0.0, 0.0];
var up = [0.0, 1.0, 0.0];
var faceDir = [0.0, -1.0, 1.0];
var fov = 45.0;

var persp;
var eye;
var view;

// mouse control callbacks
function refreshViewMat()
{
    faceDir=sphericalToCartesian(1.0,azimuth,zenith);
    center=[eye[0]+faceDir[0],eye[1]+faceDir[1],eye[2]+faceDir[2]];
    view = mat4.create();
    mat4.lookAt(eye, center, up, view);
}
function handleMouseDown(event) {
    if (event.button == 2) {
        mouseLeftDown = false;
        mouseRightDown = true;
    }
    else {
        mouseLeftDown = true;
        mouseRightDown = false;
    }
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
}

function handleMouseUp(event) {
    mouseLeftDown = false;
    mouseRightDown = false;
}

function handleMouseMove(event) {

    if (!(mouseLeftDown || mouseRightDown)) {
        return;
    }
    var newX = event.clientX;
    var newY = event.clientY;

    var deltaX = newX - lastMouseX;
    var deltaY = newY - lastMouseY;

    if (mouseLeftDown) {
        azimuth -= 0.002 * deltaX;
        zenith += 0.002 * deltaY;
        zenith = Math.min(Math.max(zenith, 0.001), Math.PI - 0.001);
    }
    else {
    }
    //eye = sphericalToCartesian(radius, azimuth, zenith);
    refreshViewMat();
    lastMouseX = newX;
    lastMouseY = newY;
}

function inithandleMouseWheel()
{
    window.onmousewheel=function(event)
    {
        var movdir = [0.0,0.1,0.0];
        if(event.wheelDelta<0.0)
        {
            eye=vecsub(eye,movdir);
        }
        else
        {
            eye=vecadd(eye,movdir);
        }
        if(eye[1]>3.0) eye[1]=3.0;
        if(eye[1]<0.1) eye[1]=0.3;
        refreshViewMat();
    };
}
///////////////////
// Camera used vec3
///////////////////

function vecadd(a, b)
{
    return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
}
function vecsub(a, b)
{
    return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
}
function vecl(a)
{
    return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);
}
function vecnorm(a)
{
    var l = vecl(a);
    if(l<0.00000001) return a;
    return [a[0]/l,a[1]/l,a[2]/l];
}
//////////////////////////////////
///// Keyboard Control
///////////////////////////////
function initKeyboardHandle()
{
    document.addEventListener('keydown', function(event) {
        var movespeed = 0.1;
        var movdir = [faceDir[0]*movespeed,0.0,faceDir[2]*movespeed];

        movdir = vecnorm(movdir);
        movdir = [movdir[0]*movespeed,movdir[1]*movespeed,movdir[2]*movespeed];

        var leftdir = [-movdir[2],0.0,movdir[0]];

        if(event.keyCode == 87 || event.keyCode ==38) {
            eye=vecadd(eye,movdir);
        }
        else if(event.keyCode == 83 || event.keyCode == 40) {
            eye=vecsub(eye,movdir);
        }
        else if(event.keyCode == 65 || event.keyCode ==37) {
            eye=vecsub(eye,leftdir);
        }
        else if(event.keyCode == 68|| event.keyCode == 39) {
            eye=vecadd(eye,leftdir);
        }
        refreshViewMat();
    });
}

function sphericalToCartesian(r, azimuth, zenith) {
    var x = r * Math.sin(zenith) * Math.sin(azimuth);
    var y = r * Math.cos(zenith);
    var z = r * Math.sin(zenith) * Math.cos(azimuth);

    return [x, y, z];

}

function initGL(canvas) {
    try {
        gl = canvas.getContext("experimental-webgl");

        canvasWidth = canvas.width;
        canvasHeight = canvas.height;
    } catch (e) {
    }
    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }
}

function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}


function initSimShader() {
    var vertexShader = getShader(gl, "vs_quad");
    var fragmentShader = getShader(gl, "fs_simFFT");

    simProgram = gl.createProgram();
    gl.attachShader(simProgram, vertexShader);
    gl.attachShader(simProgram, fragmentShader);
    gl.linkProgram(simProgram);
    if (!gl.getProgramParameter(simProgram, gl.LINK_STATUS)) {
        alert("Could not initialise Simulation shader");
    }
 
    simProgram.vertexPositionAttribute = gl.getAttribLocation(simProgram, "position");
   
    simProgram.u_meshSizeLocation = gl.getUniformLocation(simProgram, "u_meshSize");
    simProgram.u_patchSizeLocation = gl.getUniformLocation(simProgram, "u_patchSize");
    simProgram.u_simTimeLocation = gl.getUniformLocation(simProgram, "u_time");
    simProgram.samplerUniform = gl.getUniformLocation(simProgram, "u_simData");

}

////// Initialize shader for full-resolution grids//////
function initRenderShader()
{
    var vertexShader = getShader(gl, "vs_render");
    var fragmentShader = getShader(gl, "fs_render");

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise rendering shaders");
    }

    
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "position");
    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "normal");
    shaderProgram.vertexTexCoordAttribute = gl.getAttribLocation(shaderProgram, "texCoord");
    shaderProgram.vertexOffsetAttribute = gl.getAttribLocation(shaderProgram, "offset");
  
    shaderProgram.u_modelLocation = gl.getUniformLocation(shaderProgram, "u_model");
    shaderProgram.u_viewLocation = gl.getUniformLocation(shaderProgram, "u_view");
    shaderProgram.u_modelViewLocation = gl.getUniformLocation(shaderProgram, "u_modelView");
    shaderProgram.u_perspLocation = gl.getUniformLocation(shaderProgram, "u_persp");
    shaderProgram.u_modelViewInvLocation = gl.getUniformLocation(shaderProgram, "u_modelViewInverse");
    shaderProgram.u_invTransLocation = gl.getUniformLocation(shaderProgram,"u_normalMatrix");
    shaderProgram.u_modelViewPerspectiveLocation = gl.getUniformLocation(shaderProgram,"u_modelViewPerspective");

    shaderProgram.u_meshSizeLocation= gl.getUniformLocation(shaderProgram, "u_meshSize");
    shaderProgram.u_shaderTimeLocation= gl.getUniformLocation(shaderProgram, "u_time");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "u_simData");
}

////// Initialize shader for low-resolution grids//////
function initLowResRenderShader()
{
    var vertexShader = getShader(gl, "vs_render_lowres");
    var fragmentShader = getShader(gl, "fs_render_lowres");

    shaderProgram_lowres = gl.createProgram();
    gl.attachShader(shaderProgram_lowres, vertexShader);
    gl.attachShader(shaderProgram_lowres, fragmentShader);
    gl.linkProgram(shaderProgram_lowres);

    if (!gl.getProgramParameter(shaderProgram_lowres, gl.LINK_STATUS)) {
        alert("Could not initialise rendering shaders");
    }


    shaderProgram_lowres.vertexPositionAttribute = gl.getAttribLocation(shaderProgram_lowres, "position");
    shaderProgram_lowres.vertexNormalAttribute = gl.getAttribLocation(shaderProgram_lowres, "normal");
    shaderProgram_lowres.vertexTexCoordAttribute = gl.getAttribLocation(shaderProgram_lowres, "texCoord");
    shaderProgram_lowres.vertexOffsetAttribute = gl.getAttribLocation(shaderProgram_lowres, "offset");

    shaderProgram_lowres.u_modelLocation = gl.getUniformLocation(shaderProgram_lowres, "u_model");
    shaderProgram_lowres.u_viewLocation = gl.getUniformLocation(shaderProgram_lowres, "u_view");
    shaderProgram_lowres.u_modelViewLocation = gl.getUniformLocation(shaderProgram_lowres, "u_modelView");
    shaderProgram_lowres.u_perspLocation = gl.getUniformLocation(shaderProgram_lowres, "u_persp");
    shaderProgram_lowres.u_modelViewInvLocation = gl.getUniformLocation(shaderProgram_lowres, "u_modelViewInverse");
    shaderProgram_lowres.u_invTransLocation = gl.getUniformLocation(shaderProgram_lowres,"u_normalMatrix");
    shaderProgram_lowres.u_modelViewPerspectiveLocation = gl.getUniformLocation(shaderProgram_lowres,"u_modelViewPerspective");

    shaderProgram_lowres.u_meshSizeLocation= gl.getUniformLocation(shaderProgram_lowres, "u_meshSize");
    shaderProgram_lowres.u_shaderTimeLocation= gl.getUniformLocation(shaderProgram_lowres, "u_time");
    shaderProgram_lowres.samplerUniform = gl.getUniformLocation(shaderProgram_lowres, "u_simData");
}


function initSpectrumTexture()
{
	var initSpectrumArray = new Float32Array(meshSize*meshSize*4);
	var k = 0;
	for(var j = 0; j < meshSize; j++)
		for(var i = 0; i < meshSize; i++) 
		{
	        var h0 = new generate_h0(i, j);
			initSpectrumArray[k++] = h0.re;
			initSpectrumArray[k++] = h0.im;
			initSpectrumArray[k++] = 0.0;
			initSpectrumArray[k++] = 0.0;
		}
	
    initialSpectrumTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, initialSpectrumTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, meshSize, meshSize, 0, gl.RGBA, gl.FLOAT, initSpectrumArray);

    gl.bindTexture(gl.TEXTURE_2D, null);
}
function translateGridCoord(i,j,w)
{
    return i+j*w;
}

////// Initialize the positions, indices and texcoord of the full resolution grid//////
function initGrid()
{
    var positions = new Float32Array(meshSize*meshSize*3);
    var texCoords = new Float32Array(meshSize*meshSize*2);
    var delta_half = 0.5 / (meshSize);
    for(var j=0;j<meshSize;j++) 
    	for(var i=0;i<meshSize;i++)
	    {
	        var idx=translateGridCoord(i,j,meshSize);
	        positions[idx*3]= (j - (meshSize-1)*0.5) / (meshSize-1) * patchSize ;
	        positions[idx*3+1] = 0.0;
	        positions[idx*3+2] = (i - (meshSize-1)*0.5) / (meshSize-1) * patchSize ;

	        texCoords[idx*2]= i / (meshSize)+delta_half;
	        texCoords[idx*2+1] = j / (meshSize)+delta_half;
	    }
    
    oceanPatchPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,oceanPatchPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,positions,gl.STATIC_DRAW);
    
    oceanPatchTexCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,oceanPatchTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,texCoords,gl.STATIC_DRAW);

    var indices = new Uint32Array((meshSize-1)*(meshSize-1)*6);
    var currentQuad=0;
    for(var j=0;j<meshSize-1;j++) 
    	for(var i=0;i<meshSize-1;i++)  
	    {
	        indices[currentQuad*6]   = translateGridCoord(i,j,meshSize);
	        indices[currentQuad*6+1] = translateGridCoord(i+1,j,meshSize);
	        indices[currentQuad*6+2] = translateGridCoord(i,j+1,meshSize);
	        indices[currentQuad*6+3] = translateGridCoord(i+1,j,meshSize);
	        indices[currentQuad*6+4] = translateGridCoord(i+1,j+1,meshSize);
	        indices[currentQuad*6+5] = translateGridCoord(i,j+1,meshSize);
	        currentQuad++;
	    }
    oceanPatchIndicesBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,oceanPatchIndicesBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
    oceanPatchIndicesBuffer.numitems=currentQuad*6;


}
////// Initialize the positions, indices and texcoord of the low resolution grid//////
function initLowResGrid(levelidx)
{

    var theMeshSize = lowresSizes[levelidx];
    var positions = new Float32Array(theMeshSize*theMeshSize*3);
    var texCoords = new Float32Array(theMeshSize*theMeshSize*2);
    var delta_half = 0.5 / (theMeshSize);
    for(var j=0;j<theMeshSize;j++)
        for(var i=0;i<theMeshSize;i++)
        {
            var idx=translateGridCoord(i,j,theMeshSize);

            positions[idx*3]= (j - (theMeshSize-1)*0.5) / (theMeshSize-1) * patchSize ;
            positions[idx*3+1] = 0.0;
            positions[idx*3+2] = (i - (theMeshSize-1)*0.5) / (theMeshSize-1) * patchSize ;

            texCoords[idx*2]= i / theMeshSize+delta_half;
            texCoords[idx*2+1] = j / theMeshSize+delta_half;

        }

    oceanPatchPositionBuffer_Low[levelidx] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,oceanPatchPositionBuffer_Low[levelidx]);
    gl.bufferData(gl.ARRAY_BUFFER,positions,gl.STATIC_DRAW);

    oceanPatchTexCoordBuffer_Low[levelidx] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,oceanPatchTexCoordBuffer_Low[levelidx]);
    gl.bufferData(gl.ARRAY_BUFFER,texCoords,gl.STATIC_DRAW);

    var indices = new Uint32Array((theMeshSize-1)*(theMeshSize-1)*6);
    var currentQuad=0;
    for(var j=0;j<theMeshSize-1;j++)
        for(var i=0;i<theMeshSize-1;i++)
        {
            indices[currentQuad*6]   = translateGridCoord(i,j,theMeshSize);
            indices[currentQuad*6+1] = translateGridCoord(i+1,j,theMeshSize);
            indices[currentQuad*6+2] = translateGridCoord(i,j+1,theMeshSize);
            indices[currentQuad*6+3] = translateGridCoord(i+1,j,theMeshSize);
            indices[currentQuad*6+4] = translateGridCoord(i+1,j+1,theMeshSize);
            indices[currentQuad*6+5] = translateGridCoord(i,j+1,theMeshSize);
            currentQuad++;
        }
    oceanPatchIndicesBuffer_Low[levelidx]=gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,oceanPatchIndicesBuffer_Low[levelidx]);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
    oceanPatchIndicesBuffer_Low[levelidx].numitems=currentQuad*6;
}


function initQuad()
{
    ///////////////////////////////
    /// Initialize the quad, using Triangle_Strip to draw it!
    /// positions are -1,-1; -1,1; 1,1; 1,-1
    /// And indices are 0,1,2,0,2,3
    ///////////////////////////////
	var quadPos=[-1.0,-1.0,
	             -1.0,1.0,
	             1.0,1.0,
	             1.0,-1.0];
	
    quadPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadPos), gl.STATIC_DRAW );
    
    var quadIndices=[0,1,2,0,2,3];
    quadIndicesBuffer= gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIndicesBuffer);   
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(quadIndices), gl.STATIC_DRAW);
}


function simulation()
{
    //THIS IS THE FIRST PASS THAT USE GLSL TO COMPUTE THE HEIGHT FIELD TO THE spectrumTextureA BUFFER
    gl.useProgram(simProgram);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, spectrumFramebuffer);
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, spectrumTextureA, 0);
    
    gl.viewport(0, 0, meshSize, meshSize);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadPositionBuffer);
    gl.vertexAttribPointer(simProgram.vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(simProgram.vertexPositionAttribute);

    gl.uniform1f(simProgram.u_simTimeLocation, currentTime);
    gl.uniform1f(simProgram.u_meshSizeLocation, meshSize);
    gl.uniform1f(simProgram.u_patchSizeLocation, patchSize);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, initialSpectrumTex);
    gl.uniform1i(simProgram.samplerUniform, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIndicesBuffer);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT,0);
    
    gl.disableVertexAttribArray(simProgram.vertexPositionAttribute);    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(null);

}

//Do two passes for 2D FFT
function FFT()
{
	gl.viewport(0, 0, meshSize, meshSize);
	gl.bindBuffer(gl.ARRAY_BUFFER, quadPositionBuffer);
	gl.bindFramebuffer(gl.FRAMEBUFFER, spectrumFramebuffer);    
    // FFT horizontal pass
    gl.useProgram(fftHorizontalProgram);

    gl.vertexAttribPointer(fftHorizontalProgram.vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(fftHorizontalProgram.vertexPositionAttribute);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIndicesBuffer);
    
    var isEvenStage = true;
    for(var i = 0; i < numFFTStages; ++i)
	{
    	if(isEvenStage)
		{   		
    		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, spectrumTextureB, 0);
    		
    		gl.activeTexture(gl.TEXTURE0);
	    	gl.bindTexture(gl.TEXTURE_2D, spectrumTextureA);
	    	gl.uniform1i(fftHorizontalProgram.fftDataUniform, 0);
	    	
    		gl.activeTexture(gl.TEXTURE1);
	    	gl.bindTexture(gl.TEXTURE_2D, butterflyTextures[i]);
	    	gl.uniform1i(fftHorizontalProgram.butterflyUniform, 1);	  	
		}
    	else
		{
    		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, spectrumTextureA, 0);
    		
    		gl.activeTexture(gl.TEXTURE0);
	    	gl.bindTexture(gl.TEXTURE_2D, spectrumTextureB);	
	    	gl.uniform1i(fftHorizontalProgram.fftDataUniform, 0);	
	    	
	    	gl.activeTexture(gl.TEXTURE1);
	    	gl.bindTexture(gl.TEXTURE_2D, butterflyTextures[i]);
	    	gl.uniform1i(fftHorizontalProgram.butterflyUniform, 1);	
		}
    	
    	
    	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT,0);  	
    	isEvenStage = !isEvenStage;
	}
       
    gl.disableVertexAttribArray(fftHorizontalProgram.vertexPositionAttribute);    
    
    // FFT vertical pass, note we do not swap the real part and imaginary part back from the result because we still have an inverse FFT pass to do
    gl.useProgram(fftVerticalProgram);
        
    gl.vertexAttribPointer(fftVerticalProgram.vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(fftVerticalProgram.vertexPositionAttribute);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIndicesBuffer);
    
    for(var i = 0; i < numFFTStages; ++i)
	{
    	if(isEvenStage)
		{
    		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, spectrumTextureB, 0);
    		
    		gl.activeTexture(gl.TEXTURE0);
	    	gl.bindTexture(gl.TEXTURE_2D, spectrumTextureA);
	    	gl.uniform1i(fftVerticalProgram.fftDataUniform, 0);	
	    	
    		gl.activeTexture(gl.TEXTURE1);
	    	gl.bindTexture(gl.TEXTURE_2D, butterflyTextures[i]);
	    	gl.uniform1i(fftVerticalProgram.butterflyUniform, 1);	
     	
		}
    	else
		{
    		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, spectrumTextureA, 0);
    		
    		gl.activeTexture(gl.TEXTURE0);
	    	gl.bindTexture(gl.TEXTURE_2D, spectrumTextureB);	
	    	gl.uniform1i(fftVerticalProgram.fftDataUniform, 0);		
	    	
	    	gl.activeTexture(gl.TEXTURE1);
	    	gl.bindTexture(gl.TEXTURE_2D, butterflyTextures[i]);
	    	gl.uniform1i(fftVerticalProgram.butterflyUniform, 1);
	    	
		}
    	   	
    	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT,0);   	
    	isEvenStage = !isEvenStage;
	}
    
    heightFieldTex = isEvenStage ? spectrumTextureA : spectrumTextureB;
    
    gl.disableVertexAttribArray(fftVerticalProgram.vertexPositionAttribute);    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(null);

}
/////// render the low-resolution patch //////////////
function renderLowRes(levelidx,xoffset,zoffset)
{
    gl.useProgram(shaderProgram_lowres);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.viewport(0, 0, canvasWidth,canvasHeight);

    gl.enable(gl.DEPTH_TEST);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, heightFieldTex);
    gl.uniform1i(shaderProgram_lowres.samplerUniform, 2);


    var mv = mat4.create();
    var mymodel = mat4.create();
    for(var i=0;i<16;i++)mymodel[i]=model[i];

    mat4.translate(mymodel,[xoffset*(patchSize),patchYOffset[levelidx],zoffset*(patchSize)],mymodel);
    mat4.multiply(view, mymodel, mv);

    var invMV = mat4.create();
    mat4.inverse(mv,invMV);

    var mvp = mat4.create();
    mat4.multiply(persp, mv, mvp);

    var invTrans=mat4.create();
    mat4.inverse(mv,invTrans);
    mat4.transpose(invTrans,invTrans);

    gl.uniform1f(shaderProgram_lowres.u_meshSizeLocation, lowresSizes[levelidx]);


    gl.uniform1f(shaderProgram_lowres.u_shaderTimeLocation, currentTime);
    gl.uniformMatrix4fv(shaderProgram_lowres.u_modelViewLocation, false, mv);
    gl.uniformMatrix4fv(shaderProgram_lowres.u_modelViewPerspectiveLocation, false, mvp);
    gl.uniformMatrix4fv(shaderProgram_lowres.u_invTransLocation, false, invTrans);
    gl.uniformMatrix4fv(shaderProgram_lowres.u_modelLocation, false, mymodel);
    gl.uniformMatrix4fv(shaderProgram_lowres.u_viewLocation, false, view);
    gl.uniformMatrix4fv(shaderProgram_lowres.u_perspLocation, false, persp);
    gl.uniformMatrix4fv(shaderProgram_lowres.u_modelViewInvLocation, false, invMV);

    gl.uniform4f(gl.getUniformLocation(shaderProgram_lowres, "sky_params1"), sky_params1.x,sky_params1.y,sky_params1.z,sky_params1.w);
    gl.uniform4f(gl.getUniformLocation(shaderProgram_lowres, "sky_params2"), sky_params2.x,sky_params2.y,sky_params2.z,sky_params2.w);
    gl.uniform4f(gl.getUniformLocation(shaderProgram_lowres, "sky_params3"), sky_params3.x,sky_params3.y,sky_params3.z,sky_params3.w);
    gl.uniform4f(gl.getUniformLocation(shaderProgram_lowres, "sky_params4"), sky_params4.x,sky_params4.y,sky_params4.z,sky_params4.w);
    gl.uniform4f(gl.getUniformLocation(shaderProgram_lowres, "sky_params5"), sky_params5.x,sky_params5.y,sky_params5.z,sky_params5.w);
    gl.uniform4f(gl.getUniformLocation(shaderProgram_lowres, "sky_params6"), sky_params6.x,sky_params6.y,sky_params6.z,sky_params6.w);


    gl.uniform3f(gl.getUniformLocation(shaderProgram_lowres, "eyePos"), eye[0],eye[1],eye[2]);
    gl.uniform1f(gl.getUniformLocation(shaderProgram_lowres, "u_patchSize"), patchSize);
    gl.uniform3f(gl.getUniformLocation(shaderProgram_lowres, "u_oceancolor"), oceanColor[0],oceanColor[1],oceanColor[2]);
    gl.uniform3f(gl.getUniformLocation(shaderProgram_lowres, "u_sunPos"), sunPos[0],sunPos[1],sunPos[2]);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, oceanPatchIndicesBuffer_Low[levelidx]);

    gl.bindBuffer(gl.ARRAY_BUFFER, oceanPatchPositionBuffer_Low[levelidx]);
    gl.vertexAttribPointer(shaderProgram_lowres.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shaderProgram_lowres.vertexPositionAttribute);

    gl.bindBuffer(gl.ARRAY_BUFFER, oceanPatchTexCoordBuffer_Low[levelidx]);
    gl.vertexAttribPointer(shaderProgram_lowres.vertexTexCoordAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shaderProgram_lowres.vertexTexCoordAttribute);


    gl.drawElements(gl.TRIANGLES, oceanPatchIndicesBuffer_Low[levelidx].numitems, gl.UNSIGNED_INT,0);

    /*gl.bindBuffer(gl.ARRAY_BUFFER, oceanPatchOffsetBuffer);
     gl.enableVertexAttribArray(shaderProgram.vertexOffsetAttribute);
     gl.vertexAttribPointer(shaderProgram.vertexOffsetAttribute, 3, gl.FLOAT, false, 0, 0);
     instancingEXT.vertexAttribDivisorANGLE(shaderProgram.vertexOffsetAttribute, 1);

     instancingEXT.drawElementsInstancedANGLE(gl.TRIANGLES, oceanPatchIndicesBuffer.numitems, gl.UNSIGNED_SHORT, 0, oceanPatchOffsetBuffer.instanceCount);

     instancingEXT.vertexAttribDivisorANGLE(shaderProgram.vertexOffsetAttribute, 0);    */

    gl.disableVertexAttribArray(shaderProgram_lowres.vertexPositionAttribute);
    gl.disableVertexAttribArray(shaderProgram_lowres.vertexTexCoordAttribute);
}

/////// render the full-resolution patch//////////////
function render(xoffset,zoffset)
{
    //This is the 3rd pass that use GLSL to render the image, using spectrumTextureA to be the height field of the wave

    gl.useProgram(shaderProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.viewport(0, 0, canvasWidth,canvasHeight);
   
    gl.enable(gl.DEPTH_TEST);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, heightFieldTex);
    gl.uniform1i(shaderProgram.samplerUniform, 2);

    var mymodel = mat4.create();
    for(var i=0;i<16;i++)mymodel[i]=model[i];
    mat4.translate(mymodel,[xoffset*(patchSize),0,zoffset*(patchSize)],mymodel);
    var mv = mat4.create();
    mat4.multiply(view, mymodel, mv);
    
    var invMV = mat4.create();
    mat4.inverse(mv,invMV);
    
    var mvp = mat4.create();
    mat4.multiply(persp, mv, mvp);
    
    var invTrans=mat4.create();
    mat4.inverse(mv,invTrans);
    mat4.transpose(invTrans,invTrans);

    gl.uniform1f(shaderProgram.u_meshSizeLocation, meshSize);
    
    gl.uniform1f(shaderProgram.u_shaderTimeLocation, currentTime);
    gl.uniformMatrix4fv(shaderProgram.u_modelViewLocation, false, mv);
    gl.uniformMatrix4fv(shaderProgram.u_modelViewPerspectiveLocation, false, mvp);
    gl.uniformMatrix4fv(shaderProgram.u_invTransLocation, false, invTrans);
    gl.uniformMatrix4fv(shaderProgram.u_modelLocation, false, mymodel);
    gl.uniformMatrix4fv(shaderProgram.u_viewLocation, false, view);
    gl.uniformMatrix4fv(shaderProgram.u_perspLocation, false, persp);
    gl.uniformMatrix4fv(shaderProgram.u_modelViewInvLocation, false, invMV);

    gl.uniform4f(gl.getUniformLocation(shaderProgram, "sky_params1"), sky_params1.x,sky_params1.y,sky_params1.z,sky_params1.w);
    gl.uniform4f(gl.getUniformLocation(shaderProgram, "sky_params2"), sky_params2.x,sky_params2.y,sky_params2.z,sky_params2.w);
    gl.uniform4f(gl.getUniformLocation(shaderProgram, "sky_params3"), sky_params3.x,sky_params3.y,sky_params3.z,sky_params3.w);
    gl.uniform4f(gl.getUniformLocation(shaderProgram, "sky_params4"), sky_params4.x,sky_params4.y,sky_params4.z,sky_params4.w);
    gl.uniform4f(gl.getUniformLocation(shaderProgram, "sky_params5"), sky_params5.x,sky_params5.y,sky_params5.z,sky_params5.w);
    gl.uniform4f(gl.getUniformLocation(shaderProgram, "sky_params6"), sky_params6.x,sky_params6.y,sky_params6.z,sky_params6.w);


    gl.uniform3f(gl.getUniformLocation(shaderProgram, "eyePos"), eye[0],eye[1],eye[2]);
    gl.uniform1f(gl.getUniformLocation(shaderProgram, "u_patchSize"), patchSize);
    gl.uniform3f(gl.getUniformLocation(shaderProgram, "u_oceancolor"), oceanColor[0],oceanColor[1],oceanColor[2]);
    gl.uniform3f(gl.getUniformLocation(shaderProgram, "u_sunPos"), sunPos[0],sunPos[1],sunPos[2]);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, oceanPatchIndicesBuffer);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, oceanPatchPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    gl.bindBuffer(gl.ARRAY_BUFFER, oceanPatchTexCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexTexCoordAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shaderProgram.vertexTexCoordAttribute);


    gl.drawElements(gl.TRIANGLES, oceanPatchIndicesBuffer.numitems, gl.UNSIGNED_INT,0);

    gl.disableVertexAttribArray(shaderProgram.vertexPositionAttribute);
    gl.disableVertexAttribArray(shaderProgram.vertexTexCoordAttribute);     
}

function animate()
{
	gl.clear(gl.COLOR_BUFFER_BIT);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    simulation();
    FFT();
    skyrender();
    var curoffset = getEyeArea();
    //render(curoffset[0],curoffset[1]);

    var i,j;

    var range = 8;
    //////Draw a bunch of patches around the camera
    for(i=-range;i<=range;i++) for(j=-range;j<=range;j++)
    {
        var method = checkVertexVisibility(curoffset[0]+i,curoffset[1]+j);
        if(method==-1)render(curoffset[0]+i,curoffset[1]+j);
   /////// use different level of grid according to the distance
        else renderLowRes(method,curoffset[0]+i,curoffset[1]+j);
    }

    var nowtime=new Date().getTime();
    if(nowtime-1000>startTime)
    {
        document.title = "WebGL Water Shader ["+new Number(totalFrames*1000/(new Date().getTime()-startTime)).toPrecision(3)+"fps]";
        startTime=nowtime;
        totalFrames=0;
    }
}

function tick(){
    requestAnimFrame(tick);
    stats.update();
    currentTime=currentTime + 0.01;
    totalFrames++;
    animate();
}


function webGLStart() {
	// FPS indicator
	stats = new Stats();
    stats.setMode(0); // 0: fps, 1: ms

    // Align top-left
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '1000px';
    stats.domElement.style.top = '1000px';

    document.body.appendChild( stats.domElement );

  
    startTime=new Date().getTime();
    totalFrames = 0;
    var canvas = document.getElementById("canvas1");
    initGL(canvas);

    canvas.onmousedown = handleMouseDown;
    canvas.oncontextmenu = function (ev) { return false; };
    document.onmouseup = handleMouseUp;
    document.onmousemove = handleMouseMove;

    ////// initialize camera, sun and model matrix
    sun_azimuth=Math.PI/4.0;
    sun_zenith=Math.PI/2.0-Math.PI/10.0;
    sunPos=sphericalToCartesian(1000.0,sun_azimuth,sun_zenith);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    persp = mat4.create();
    mat4.perspective(fov*2.0, canvas.width / canvas.height, 0.1, 150.0, persp);

    eye=[0.0,1.5,0.0];
    azimuth = sun_azimuth;
    zenith = Math.PI / 2.0;
    faceDir=sphericalToCartesian(1.0,azimuth,zenith);


    center=[eye[0]+faceDir[0],eye[1]+faceDir[1],eye[2]+faceDir[2]];
    view = mat4.create();
    mat4.lookAt(eye, center, up, view);
    model = mat4.create();

    mat4.identity(model);
    scalar = 0.1;
    patchYOffset=[-0.0001*scalar*10.0,-0.006*scalar*10.0,-0.010*scalar*100.0];

    mat4.scale(model, [1.0*scalar, 10.0*scalar, 1.0*scalar]);


    /////////// Query extension
    var OES_texture_float = gl.getExtension('OES_texture_float');
    if (!OES_texture_float) {
        throw new Error("No support for OES_texture_float");
    }

    var OES_element_index_uint = gl.getExtension('OES_element_index_uint');
    if (!OES_element_index_uint) {
        throw new Error("No support for OES_element_index_uint");
    }
    
    var MaxVertexTextureImageUnits = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    if (MaxVertexTextureImageUnits <= 0) {
        throw new Error("No support for vertex texture fetch");
    }

    sky_props = new skyprop();
    initKeyboardHandle();
    inithandleMouseWheel();
    initSimShader();
    initFFTHorizontalShader();
    initFFTVerticalShader();
    initRenderShader();
    initLowResRenderShader();
    initSkyShader();
      
    initSpectrumTexture();
    initButterflyTextures();
    initFFTFramebuffer();
    
    initQuad();
    initGrid();

    ///// init low resolution patches grids
    oceanPatchPositionBuffer_Low=new Array(3);
    oceanPatchTexCoordBuffer_Low=new Array(3);
    oceanPatchIndicesBuffer_Low=new Array(3);
    for(var i=0;i<3;i++)
    {
        initLowResGrid(i);
    }

    tick();
    
}