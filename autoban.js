// ==UserScript==
// @name         自动封禁装置，启动！
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  再见了！广告君
// @author       holynnchen
// @match        https://live.bilibili.com/*
// @grant        none
// ==/UserScript==

/*毕竟是基于相似度进行封禁的，可能存在误封、漏封的情况，请及时查看封禁信息避免误封*/
/*语料库功能还不完善，请谨慎使用，不同方法所使用的语料库均不同*/

/*菜单指令 开发者工具中使用*/
//autoban.showStatus()  查看运行情况
//autoban.showBan()     查看封禁情况
//autoban.clearUID(uid)  根据指定uid删除ban_db中数据
//autoban.addCorpus()   将当前ban_db中每个uid的第一条发言不重复的放入当前语料库中

const ban_limit=0.7;//弹幕相似率大于ban_limit时自动禁言
let count_in=0,count_ban=0,count_clear=0;//弹幕入库次数、弹幕封禁次数、清理次数
const startCheck=3;//timeRange内长弹幕数量大于startCheck开始检测（不含startCheck）
const timeRange=20000;//只统计timeRange这段时间内的弹幕
const useCorpus=false;//是否启用语料库
const filterList=[filter1,filter2];//匹配过滤函数，若其中一个返回true都认为是正常弹幕，针对B站默认采用filter1与filter2
const CorpusCheck_choice=new CorpusCheck_base(0.85);//选择语料库函数进行快速封禁，有下述方法
//CorpusCheck_base  相似度匹配 参数 匹配度下限     特点：根据编辑距离计算相似度，结构为数组，每次都对语料库进行由新到旧的compare，因此前期快，封禁数量上升后慢
//CorpusCheck_lost  随机损失法 参数 损失度上限     特点：使用随机损失法做字典，因此储存占用较大，损失度越大每次操作耗时越大，但每次操作的耗时都是相对固定的
//CorpusCheck_equal 精确匹配法 参数 无             特点：使用原封禁弹幕做字典，内存占用小，对广告有一定变形机制作用较小(指非混淆的第一句弹幕)，但几乎不耗时
const filter1_config=0.75;//弹幕内同一字符占弹幕长度的分数，大于该值视为正常弹幕
const filter2_config=[];//含有数组内的子字符串的均视为正常弹幕

const startTime=Date.now();
const csrf=getCookie('bili_jct');// use for ban
let RoomLongID;//window.BilibiliLive.ROOMID
let RoomShortID;//window.BilibiliLive.SHORT_ROOMID

//初始化工作
(async ()=>{
    await waitCreat(window,'BilibiliLive');
    RoomLongID=await waitCreat(window.BilibiliLive,'ROOMID');
    RoomShortID=await waitCreat(window.BilibiliLive,'SHORT_ROOMID');
    show('机器人自动封禁装置初始化中...');
    let res=await fetch('https://api.live.bilibili.com/live_user/v1/UserInfo/get_info_in_room?roomid='+RoomLongID,{credentials: "include"});
    res=await res.json();
    if(res.code==0){
        if(res.data.room_admin.is_admin){
            main();
        }else{
            show('您还不是本房间的房管，装置已自动关闭！')
        }
    }else{
        show('获取信息异常，请刷新页面重新获取！')
        console.log(res);
    };
})()

//主运行函数
function main() {
    'use strict';
    if(window.globalObserver)globalObserver.disconnect();
    window.globalSaver={};
    window.ban_db=[];
    let prepareDelete={};
    let globalObserver=new MutationObserver((mutations)=>{
        doOne:for(let i of mutations){
            if(i.addedNodes.length!=0){
                for(let j of i.addedNodes){
                    if(j.dataset.danmaku&&j.dataset.danmaku.length>9){
                        count_in++;
                        let uid=j.dataset.uid,name=j.dataset.uname,danmu=j.dataset.danmaku;
                        // 例外规则
                        for(let filterCheck of filterList){
                            if(filterCheck(danmu))continue doOne;
                        }
                        // 例外规则结束
                        if(!window.globalSaver[uid]){
                            window.globalSaver[uid]=[]
                        }
                        let nowtime=Date.now();
                        window.globalSaver[uid].push([nowtime,danmu]);
                        window.globalSaver[uid]=window.globalSaver[uid].filter((item)=>nowtime-item[0]<timeRange);
                        // 查询语料库
                        if(useCorpus){
                            if(CorpusCheck_choice.check(danmu)){
                                ban_user(uid,name);
                                continue;
                            }
                        }
                        // 查询语料库结束
                        let deleteMark=true,temp_length=window.globalSaver[uid].length;
                        if(temp_length>startCheck){
                            if(prepareDelete[uid])continue;
                            let allcompare=0;
                            for(let i=1;deleteMark&&i<temp_length;i++){
                                allcompare=(allcompare*(i-1)+compare(window.globalSaver[uid][temp_length-i][1],window.globalSaver[uid][temp_length-i-1][1]))/i;
                                if(i>2 && allcompare>ban_limit)break;
                            }
                            if(allcompare>ban_limit){
                                if(prepareDelete[uid])continue;
                                ban_user(uid,name);
                            }
                        }
                    }
                }
            }
        }
    });
    globalObserver.observe(document.body.querySelector('.chat-history-list'),{childList:true});
    show('机器人自动封禁装置，启动!');
    show(`设定定时任务：自动清理小本本 1次/${timeRange/1000}s`);
    setInterval(()=>{
        let nowtime=Date.now();
        count_clear++;
        for(let i in window.globalSaver){
            window.globalSaver[i]=window.globalSaver[i].filter((item)=>nowtime-item[0]<timeRange);
            if(window.globalSaver[i].length==0){
                delete window.globalSaver[i];
            }
        }
    },timeRange);
    //内部函数
    function ban_user(uid,name=''){
        prepareDelete[uid]=true;
        count_ban++;
        show(`自动禁言${name}(${uid})`)
        let savetemp=deepCopy(window.globalSaver[uid])
        fetch('https://api.live.bilibili.com/banned_service/v2/Silent/add_block_user',
              {method:'POST',
               credentials: "include",
               headers:{'Content-Type':'application/x-www-form-urlencoded'},
               body:createFormData({roomid:RoomLongID,block_uid:uid,hour:720,csrf_token:csrf,csrf:csrf})})
            .then(res=>res.json())
            .then(res=>{
            if(res.code==0){
                window.ban_db.push([Date.now(),name,uid,savetemp]);
                delete prepareDelete[uid];
            }
        })
    }
};

function compare(s1,s2) {
    let len1=s1.length,len2=s2.length;
    let d=[];
    let i,j;
    for(i = 0;i <= len1;i++){
        d[i]= i;
    }
    for(i = 1;i <= len2;i++){
        let left=i,up=i-1;
        for(j = 1;j <= len1;j++) {
            let cost = s2[i-1] == s1[j-1] ? 0 : 1;
            left= Math.min(d[j]+1,left+1,up+cost);
            up=d[j];
            d[j]=left;
        }
    }
    return Math.min(1-d[len1]/len1,1-d[len1]/len2);
}

/*过滤函数*/

function filter1(s){
    let max_in=0,temp_save={};
    for(let i of s){
        if(!temp_save[i])temp_save[i]=0;
        temp_save[i]++;
        max_in=Math.max(max_in,temp_save[i]);
    }
    return (max_in/s.length)>filter1_config;
}

function filter2(s){
    for(let i=0;i<filter2_config.length;i++){
        if(s.indexOf(filter2_config[i])>-1)return true;
    }
    return false;
}

/*工具函数*/
function getCookie(name){
    let arr,reg=new RegExp("(^| )"+name+"=([^;]*)(;|$)");
    if(arr=document.cookie.match(reg)){return unescape(arr[2]);}
    else{return null;}
}
function createFormData(data){
    let result=[];
    for(let key in data){
        result.push(`${key}=${data[key]}`)
    }
    return result.join('&')
}
function show(str){
    console.log(`[${RoomShortID}]> `+str+' '.repeat(40-getBytes(str))+(new Date()).toLocaleString());
}
function easy_show(str){
    console.log(`[${RoomShortID}]> `+str);
}
function getBytes(str){
    return str.replace(/[^\u0000-\u00ff]/g,'  ').length
}
function deepCopy(data){
    let databak=[]
    for(let i in data){
        databak.push([...data[i]])
    }
    return databak
}
function waitCreat(obj,prop,sleep=10){
    return new Promise((resolve,reject)=>{
        if(obj[prop]){
            resolve(obj[prop]);
            return;
        }
        let waiter=setInterval(()=>{
            if(obj[prop]){
                clearInterval(waiter);
                resolve(obj[prop]);
            }
        },sleep)
    })
}
String.prototype.map=function(f){return Array.from(this).map(f).join('');}
/*语料库类*/

function deformate(danmu){
    danmu=danmu.map((a)=>{
        let code=a.charCodeAt();
        if(code==12288)return '';
        if(code>65280 &&code<65375)return String.fromCharCode(code-65248);
        return a;
    });
    danmu=danmu.toLowerCase().replace(/\d/g,'#').replace(/ /g,'');
    return danmu;
}

function CorpusCheck_base(maxlimit){
    this.maxlimit=maxlimit;
    this.Corpus=JSON.parse(localStorage.getItem('Corpus_base'))||[];
    this.check=function(danmu){
        danmu=deformate(danmu);
        for(let i=this.Corpus.length-1;useCorpus&&i>-1;i--){
            if(compare(this.Corpus[i],danmu)>this.maxlimit){
                return true;
            }
        }
        return false;
    };
    this.addCorpus=function(){
        for(let i=0;i<window.ban_db.length;i++){
            let danmu=deformate(window.ban_db[i][3][0][1]);
            if(this.Corpus.indexOf(danmu)==-1){
                this.Corpus.push(danmu);
            }
        }
        localStorage.setItem('Corpus_base',JSON.stringify(this.Corpus));
        easy_show('已添加到Corpus_base语料库');
    }
}

function CorpusCheck_lost(maxlost){//数量容易过大，建议损失要控制在3字节以内
    this.maxlost=maxlost;
    if(maxlost>=0.25)throw('损失过大，易造成内存溢出');
    this.Corpus=JSON.parse(localStorage.getItem('Corpus_lost'))||{};
    this.getLostString=function*(str,maxLost){
        yield str;
        let tempresult=[str]
        for(let i=1;i<=maxLost;i++){
            let secondresult=[];
            let tempsave={};
            for(let j of tempresult){
                let thelength=j.length,lastone;
                for(let z=0;z<thelength;z++){
                    if(j[z]==lastone)continue;
                    lastone=j[z];
                    let theone=j.substring(0,z)+j.substring(z+1);
                    if(tempsave[theone])continue;
                    tempsave[theone]=true;
                    yield theone;
                    secondresult.push(theone);
                }
            }
            tempresult=secondresult;
        }
    };
    this.check=function(danmu){//随机损失法
        danmu=deformate(danmu);
        for(let i of this.getLostString(danmu,~~(this.maxlost*danmu.length))){
            if(this.Corpus[i]){
                return true
            }
        }
        return false;
    };
    this.addCorpus=function(){
        let tempsave={};
        for(let i=0;i<window.ban_db.length;i++){
            let danmu=deformate(window.ban_db[i][3][0][1]);
            if(tempsave[danmu])continue;
            tempsave[danmu]=true;
            console.log(this.getLostString(danmu,~~(this.maxlost*danmu.length)));
            for(let i of this.getLostString(danmu,~~(this.maxlost*danmu.length)))this.Corpus[i]=true;
        }
        localStorage.setItem('Corpus_lost',JSON.stringify(this.Corpus));
        easy_show('已添加到Corpus_lost语料库');
    }
}

function CorpusCheck_equal(){
    this.Corpus=JSON.parse(localStorage.getItem('Corpus_equal'))||{};
    this.check=function(danmu){
        danmu=deformate(danmu);
        if(this.Corpus[danmu])return true;
        return false;
    }
    this.addCorpus=function(){
        let tempsave={};
        for(let i=0;i<window.ban_db.length;i++){
            let danmu=deformate(window.ban_db[i][3][0][1]);
            if(tempsave[danmu])continue;
            tempsave[danmu]=true;
            this.Corpus[danmu]=true;
        }
        localStorage.setItem('Corpus_equal',JSON.stringify(this.Corpus));
        easy_show('已添加到Corpus_equal语料库');
    }
}

/*菜单函数*/
window.autoban={
    showBan:()=>{
        if(!window.ban_db.length){
            easy_show('暂无封禁记录哦~')
        }
        for(let i in window.ban_db){
            easy_show(`用户名:${window.ban_db[i][1]} UID:${window.ban_db[i][2]} 封禁时间：${(new Date(window.ban_db[i][0])).toLocaleString()} 最后发言记录：${window.ban_db[i][3][window.ban_db[i][3].length-1][1]}`)
        }
    },
    showStatus:()=>{
        easy_show('感谢使用自动封禁装置!');
        easy_show(`装置启动时间：${(new Date(startTime)).toLocaleString()}`);
        easy_show(`累计弹幕入库次数: ${count_in}`);
        easy_show(`累计弹幕封禁次数: ${count_ban}`);
        easy_show(`累计库存清理次数: ${count_clear}`);
    },
    clearUID:(uid)=>{
        for(let i=window.ban_db.length-1;i>-1;i--){
            if(window.ban_db[i][2]==uid){
                let user=window.ban_db.splice(i,1);
                easy_show(`已删除${user[1]}(${user[2]})的封禁记录`);
                return;
            }
        }
        easy_show(`未找到UID为${uid}的封禁记录`);
    },
    addCorpus:()=>{CorpusCheck_choice.addCorpus()},
}

/*调试函数*/
window.debug_autoban={
    saveBanDB:()=>{
        localStorage.setItem('ban_db',JSON.stringify(window.ban_db));
    },
    restoreBanDB:()=>{
        window.ban_db=JSON.parse(localStorage.getItem('ban_db'))||[];
    }
}
