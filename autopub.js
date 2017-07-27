/**
 * Created by wurui on 29/12/2016.
 */
//git archive --output "../oxst.tar" master
var child_process=require('child_process');
var jsonConf=require('./autopub.json');

var fs=require('fs');
var request=require('request');

var version='0.0.0';
var owner=jsonConf.owner;
var projectName=jsonConf.name;
var tarName=projectName+'_'+Math.random().toString().substr(2,6)+'.tar';
var tempPath='../'+tarName;

var startTS=Date.now();

var flag=process.argv[2];
var tagPrefix='rls/';

var useLastTag=false;

var maxVer=function(v1,v2){
    var splt1=v1.split('.'),
        splt2=v2.split('.'),
        i=0;
    while(i<3){
        var delta=splt1[i]-splt2[i];
        if(delta){
            return delta>0?v1:v2;
        }
        i++;
    }
    return v1;
};
//jsonConf.deployDir='/Users/wurui/localhost/lab';

var uploadTar=function(){

    jsonConf.version=version;
    var server_host=jsonConf.server_host||'120.26.223.237'
    var r = request.post({url:'http://'+server_host+':11100/uploadtar',headers:{
        "User-Agent": 'autopub',
        vcode:"201701031713"
    }}, function(err, httpResponse, body) {
        if(httpResponse && httpResponse.statusCode==200) {
            console.log('uploaded', body)
        }else{
            console.warn('uploaded error',httpResponse && httpResponse.statusCode,body);
            if(!useLastTag) {
                spawn('git tag -d ' + tagPrefix + version, function () {
                    console.log('tag', tagPrefix + version, 'deleted')
                });
            }
        }
        fs.unlinkSync(tempPath);
    })
    var form = r.form();
    form.append('json', JSON.stringify(jsonConf));
    form.append('file', fs.createReadStream(tempPath), {filename: tarName});

};
var spawn=function(cmdstr,callbacks){
    var splt=cmdstr.split(' '),
        main=splt.shift();
    if(typeof callbacks=='function'){
        callbacks={close:callbacks}
    };
    callbacks=Object.assign({
        close:function(){},
        error:function(err){
            console.error(err)
        },
        stdout:function(data){
            console.log('stdout: ' + data);
        },
        stderr: function (data) {
            console.log('stderr: ' + data);
        }
    },callbacks)
    var cmd=child_process.spawn(main,splt, {
        cwd: '.'
    }).on('close', callbacks.close).on('error',callbacks.error);

    cmd.stdout.on('data', callbacks.stdout);

    cmd.stderr.on('data',callbacks.stderr);
};



spawn('git tag',{
    stdout:function(data){

        var vers=data.toString().split('\n');
        var lastVer='0.0.0';
        for(var i=0;i<vers.length;i++){
            if(vers[i]) {
                lastVer = maxVer(vers[i].replace(tagPrefix, ''), lastVer);
            }
        }
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
                useLastTag=true;
                break
            default:
                verSplt[2]-= -1
                break;
        }
        var newVar=verSplt.join('.');
        version=newVar;

        var archive=function(){

            spawn('git archive --output '+tempPath+' --prefix='+projectName+'/ '+tagPrefix+newVar,function(code){

                console.log('archive done! code='+code,'cost:'+(Date.now()-startTS)+'ms');
                if(code==0){
                    console.log('uploading')
                    uploadTar();
                }
            });

        };
        console.log('use version:',newVar);
        if(useLastTag){
            archive();
        }else{

            spawn('git tag '+tagPrefix+newVar,archive)
            console.log('new tag created:', tagPrefix+newVar)
        }



    }
});

