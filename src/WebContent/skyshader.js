/**
 * Created by Guanyu He on 13-12-9.
 *
 * When doing this part, I mainly refer to the link below.
 *
 *
 *
 * Thanks very much!
 *
 */
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
////// INITIALISING THE PARAMETERS
////// FROM THE INPUT SLIDERS
////// AND TRANSFER IT TO THE PARAMETERS FOR SHADERS
//////
////// THIS PART MAINLY REFER TO
////// http://blog.cloudparty.com/2013/09/19/stunning-procedural-skies-in-webgl-part-1/
////// THANKS VERY MUCH!
//////
////////////////////////////////////////////////////////////


var sky_props;
function sqr(val) {
    return val * val;
}

function pow4(val) {
    val = val * val;
    return val * val;
}

function fromAdd(a,b)
{
    var result=new Vec4();
    result.x= a.x+ b.x;
    result.y= a.y+ b.y;
    result.z= a.z+ b.z;
    result.w= a.w+ b.w;
    return result;
}
function fromDiv(a,b)
{
    var result=new Vec4();
    result.x= a.x/ b.x;
    result.y= a.y/ b.y;
    result.z= a.z/ b.z;
    result.w= a.w/ b.w;
    return result;
}
function mulScalar(a,b)
{
    var result=new Vec4();
    result.x= a.x*b;
    result.y= a.y*b;
    result.z= a.z*b;
    result.w= a.w*b;
    return result;
}

function Vec4()
{
    this.x=0.0;
    this.y=0.0;
    this.z=0.0;
    this.w=0.0;
}

var sky_params1=new Vec4();
var sky_params2=new Vec4();
var sky_params3=new Vec4();
var sky_params4=new Vec4();
var sky_params5=new Vec4();
var sky_params6=new Vec4();

function skyprop()
{
    this.density = 0.99;
    this.clarity = 0.2;
    this.pollution = 0.03;
    this.planet_scale=1.0;
    this.atmosphere_scale=1.0;
    this.sun_disk_radius=0.1;
    this.brightness=10.0;
    this.sun_disk_intensity=0.5;
}
function initSkyShader()
{
    var vertexShader = getShader(gl, "vs_quad");
    var fragmentShader = getShader(gl, "skyFS");

    skyProgram = gl.createProgram();
    gl.attachShader(skyProgram, vertexShader);
    gl.attachShader(skyProgram, fragmentShader);
    gl.linkProgram(skyProgram);

    if (!gl.getProgramParameter(skyProgram, gl.LINK_STATUS)) {
        alert("Could not initialise sky shaders");
    }
    initSky();
    gl.useProgram(skyProgram);

    skyProgram.vertexPositionAttribute = gl.getAttribLocation(skyProgram, "position");
}
function Vec3(x,y,z)
{
    this.x=x;
    this.y=y;
    this.z=z;
}
function initSky()
{
    var sky_lambda = new Vec3(680e-9, 550e-9, 450e-9);
    var sky_k = new Vec3(0.686, 0.678, 0.666);

    var earth_radius = 6.371e6;
    var earth_atmo_thickness = 0.1e6;

    var clarity = 1 + sky_props.clarity;
    var two_pi = 2 * Math.PI;

// compute betaR
    var factor = 1.86e-31 / (clarity * Math.max(sky_props.density, 0.001));

    sky_params2.x = factor / pow4(sky_lambda.x);

    sky_params2.y = factor / pow4(sky_lambda.y);
    sky_params2.z = factor / pow4(sky_lambda.z);

// combute betaM
    factor = 1.36e-19 * Math.max(sky_props.pollution, 0.001);
    sky_params3.x = factor * sky_k.x * sqr(two_pi / sky_lambda.x);
    sky_params3.y = factor * sky_k.y * sqr(two_pi / sky_lambda.y);
    sky_params3.z = factor * sky_k.z * sqr(two_pi / sky_lambda.z);

// betaR + betaM, -(betaR + betaM), betaR / (betaR + betaM), betaM / (betaR + betaM)

    sky_params1=fromAdd(sky_params2, sky_params3);
    sky_params6=fromAdd(sky_params2, sky_params3);
    sky_params6=mulScalar(sky_params6,-1.0);
    sky_params2=fromDiv(sky_params2,sky_params1);
    sky_params3=fromDiv(sky_params3,sky_params1);

// mie scattering phase constants
    var g = (1 - sky_props.pollution) * 0.2 + 0.75;
    sky_params1.w =  sqr(1 - g) / (4 * Math.PI);
    sky_params2.w = -2 * g;
    sky_params3.w = 1 + sqr(g);

    var planet_radius = earth_radius * sky_props.planet_scale;
    var atmo_radius = planet_radius + earth_atmo_thickness * sky_props.atmosphere_scale;
    sky_params4.x = planet_radius;
    sky_params4.y = atmo_radius * atmo_radius;
    sky_params4.z = 0.15 + 0.75 *(0.5);
    sky_params4.w = atmo_radius * atmo_radius - planet_radius * planet_radius;

// sun disk cutoff
    sky_params1.y = -(1 - 0.015 * sky_props.sun_disk_radius);
    sky_params1.x = 1 / (1 + sky_params1.y);
    sky_params1.y *= sky_params1.x;

    sky_params5.x=1.0;
    sky_params5.y=1.0;
    sky_params5.z=1.0;
    sky_params5.w=1.0;sky_params5=mulScalar(sky_params5,sky_props.brightness);
    sky_params5.w = sky_props.sun_disk_intensity;

    sky_params6.w = clarity * 3 / (16 * Math.PI);
}

//// IMPORTANT! NEED TO BE MERGED!
///  skyRender: Rendering the sky
function skyrender()
{
    gl.disable(gl.DEPTH_TEST);
    // This is the 2nd path that copy the rendered result to the height-map, which can be used in the first step.
    gl.useProgram(skyProgram);
    gl.viewport(0, 0, canvasWidth,canvasHeight);
//    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadPositionBuffer);
    gl.vertexAttribPointer(skyProgram.vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(skyProgram.vertexPositionAttribute);

    gl.uniform3f(gl.getUniformLocation(skyProgram, "eyePos"), eye[0],eye[1],eye[2]);
    gl.uniform3f(gl.getUniformLocation(skyProgram, "u_sunPos"), sunPos[0],sunPos[1],sunPos[2]);
    gl.uniform3f(gl.getUniformLocation(skyProgram, "eyeCenter"), center[0],center[1],center[2]);
    gl.uniform3f(gl.getUniformLocation(skyProgram, "eyeUp"), up[0],up[1],up[2]);
    gl.uniform1f(gl.getUniformLocation(skyProgram, "fov"), fov/180.0*Math.PI);

    gl.uniform4f(gl.getUniformLocation(skyProgram, "sky_params1"), sky_params1.x,sky_params1.y,sky_params1.z,sky_params1.w);
    gl.uniform4f(gl.getUniformLocation(skyProgram, "sky_params2"), sky_params2.x,sky_params2.y,sky_params2.z,sky_params2.w);
    gl.uniform4f(gl.getUniformLocation(skyProgram, "sky_params3"), sky_params3.x,sky_params3.y,sky_params3.z,sky_params3.w);
    gl.uniform4f(gl.getUniformLocation(skyProgram, "sky_params4"), sky_params4.x,sky_params4.y,sky_params4.z,sky_params4.w);
    gl.uniform4f(gl.getUniformLocation(skyProgram, "sky_params5"), sky_params5.x,sky_params5.y,sky_params5.z,sky_params5.w);
    gl.uniform4f(gl.getUniformLocation(skyProgram, "sky_params6"), sky_params6.x,sky_params6.y,sky_params6.z,sky_params6.w);
    /*
     debugarea.innerHTML=
     "Para1 "+sky_params1.x.toString()+" "+sky_params1.y.toString()+" "+sky_params1.z.toString()+" "+sky_params1.w.toString()+"\r\n"+
     "Para2 "+sky_params2.x.toString()+" "+sky_params2.y.toString()+" "+sky_params2.z.toString()+" "+sky_params2.w.toString()+"\r\n"+
     "Para3 "+sky_params3.x.toString()+" "+sky_params3.y.toString()+" "+sky_params3.z.toString()+" "+sky_params3.w.toString()+"\r\n"+
     "Para4 "+sky_params4.x.toString()+" "+sky_params4.y.toString()+" "+sky_params4.z.toString()+" "+sky_params4.w.toString()+"\r\n"+
     "Para5 "+sky_params5.x.toString()+" "+sky_params5.y.toString()+" "+sky_params5.z.toString()+" "+sky_params5.w.toString()+"\r\n"+
     "Para6 "+sky_params6.x.toString()+" "+sky_params6.y.toString()+" "+sky_params6.z.toString()+" "+sky_params6.w.toString();*/
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIndicesBuffer);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT,0);
    gl.disableVertexAttribArray(skyProgram.vertexPositionAttribute);
}