/**
 * Created by wurui on 2019.7.21
 为了压缩代码，重新写了部署的方法
 */
//git archive --output "../oxst.tar" master
const AUTH_CODE='kqbusdtl0.7iu41dlp0p7';

const child_process=require('child_process');


const tar = require("tar");
const fs=require('fs');
const path=require('path');
const http=require('http');

const jsonConf=require('./autopub.json');
const version=jsonConf.version;//'0.0.0';
const projectName=jsonConf.name;
const startTS=Date.now();
const logger=function(){

    var args=[].slice.call(arguments,0);
    args.unshift('['+((Date.now()-startTS)/1000).toFixed(3)+']');
    console.log.apply(console,args)
};

const tempPath=path.join(__dirname,'../'+'_delopy_'+projectName+'_'+startTS);

const flag=process.argv[2];
const useLastTag=false;
logger('>>>>>StartTime',(new Date).toLocaleString(),'tempPath Dir='+tempPath)
fs.mkdirSync(tempPath);

const getCurrentVersion=function(){
    var lastVer=version;
   
    var verSplt=lastVer.split('.');

    switch (flag){
        case 't':
            verSplt[0]-= -1;
            verSplt[1]= 0;
            verSplt[2]= 0;
            break
        case 'm':
            verSplt[1]-= -1
            verSplt[2]= 0;
            break
        case 'n':
            //use last tag
            
            break
        default:
            verSplt[2]-= -1
            break;
    }
    
    return verSplt.join('.');
};

const checkAndCreateDir=(filename)=>{
    var split=filename.split('/');
    var i=1;
    
    
    while(i<split.length){
        
        var dirpath='/'+split.slice(0,i++).join('/')//slice保证了排除掉了最后一个文件名
        
        try{
            var stat=fs.statSync(dirpath)
            if(stat && stat.isDirectory()){
                
            }else{
                //logger('not'+dirpath)
            }
        }catch(e){
            //logger('not'+dirpath)
            fs.mkdirSync(dirpath);
            //logger('not'+dirpath)
        }
    }
};
const version_no=getCurrentVersion();
jsonConf.version=version_no;
fs.writeFileSync('./autopub.json',JSON.stringify(jsonConf,2,2))
logger('NEW_VERSION',version_no)

const fileList='css,img,index.html,autopub.json'.split(',');
var Tasks={
    copy:async function(){
        var exclude=/\.(less)$/;
        var loopCopy=(filename)=>{
            var stat = fs.lstatSync(filename);
            if(stat.isDirectory()){
                if(filename!='js'){//js 在下一步处理
                    var files=fs.readdirSync(filename)
                    files.forEach(x=>{
                        if(!x.startsWith('.') && !exclude.test(x)){
                            loopCopy(path.join(filename,x))
                        }
                        
                    })
                }
            }else{
                var newpath=path.join(tempPath,filename)
                checkAndCreateDir(newpath)
                fs.copyFileSync(path.join(__dirname,filename),newpath)
                
            };

        };

        fileList.forEach(loopCopy)
    }    
};

var doTask=async function(){

    for(var k in Tasks){
        logger('Task start',k)
        await Tasks[k]()
        logger('Task done',k)
    }
};
const tarName=tempPath+'/pack.tar';
doTask().then(()=>{
    logger('start tar')
    
    
    tar.c(
      {
        //gzip: <true|gzip options>,
        cwd:tempPath,
        prefix:projectName,
        file: tarName
      },
      fileList
    ).then(_ => { 

        return uploadTar();
       
        
    })
    
}).catch((e)=>{
    logger('error',e)
});



const uploadTar=function(){
    logger('uploading')

    var server_host=jsonConf.server_host||'118.178.253.89'
    //server_host='localhost'
    const req=http.request({
        //protocol:'http',
        hostname:server_host,
        port:11100,
        path:'/api/upload/deploy',
        method:'post',
        headers: {
            "User-Agent": 'autopub',
            "auth-code":AUTH_CODE
        }
    },(res)=>{
        if(res.statusCode!=200){
            logger('Error')
        }else{
            res.setEncoding('utf8');
            var allData=''
            res.on('data', (chunk) => {
                allData+=chunk.toString()
                //console.log(`BODY: ${chunk}`);
            });
            res.on('end', () => {
                logger('upload done',allData);
                child_process.spawnSync('rm',[ '-fr',tempPath]);
                
                
                logger('All done!','cost:'+(Date.now()-startTS)+'ms');
            });

        }
        

    });
    req.write(fs.readFileSync(tarName));
    req.end();
    
};