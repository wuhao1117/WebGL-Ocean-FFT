/**
 * Created by Guanyu He on 13-12-12.
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
////// THIS FILE USED TO CHECK THE POSITION OF THE EYE
////// AND RETURN THE LOD OF A PATCH
////// ACCORDING TO ITS DISTANCE FROM EYE
//////
////////////////////////////////////////////////////////////

function getEyeArea()
{
    var realsize = patchSize*scalar;
    return [Math.floor((eye[0]+realsize*0.5)/realsize),Math.floor((eye[2]+realsize*0.5)/realsize)];
}

function dist(a,b)
{
    return ((a[0]-b[0])*(a[0]-b[0])+(a[1]-b[1])*(a[1]-b[1])+(a[2]-b[2])*(a[2]-b[2]));
}
function checkVertexVisibility(xoffset, zoffset)
{
    var mymodel = mat4.create();
    for(var i=0;i<16;i++)mymodel[i]=model[i];
    //$("#testfield").text("Haha");
    mat4.translate(mymodel,[xoffset*(patchSize),0,zoffset*(patchSize)],mymodel);
    var center=[0.0,0.0,0.0,1.0];
    var result=[0.0,0.0,0.0,1.0];

    mat4.multiplyVec4(mymodel,center,result);
    var d = dist(result,eye);
    var threshold=[220,1000,2000];
    if(d<threshold[0]) return -1;
    if(d<threshold[1]) return 0;
    if(d<threshold[2]) return 1;
    return 2;
    //$("#testfield").text(d.toString());


}