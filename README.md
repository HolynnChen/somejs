# 我编写的油猴脚本

## 自动封禁装置，启动！
### autoban.js

#### bilibili广告封禁脚本，针对日益猖狂的广告君开发此脚本，供房管使用
复制到油猴即可使用，自动检测当前房间是否有房管权限  
毕竟是基于相似度进行封禁的，可能存在误封、漏封的情况，请及时查看封禁信息避免误封  
语料库功能还不完善，请谨慎使用，不同方法所使用的语料库均不同  

菜单指令 开发者工具（console）中使用

- autoban.showStatus()  查看运行情况
- autoban.showBan()     查看封禁情况
- autoban.clearUID(uid)  根据指定uid删除ban_db中数据
- autoban.addCorpus()   将当前ban_db中每个uid的第一条发言不重复的放入当前语料库中
- autoban.allReport()   一键举报所有被封禁用户，同时加入封禁窗口

相关配置均在脚本内进行修改即可，基础功能开箱即用。

#### 注意事项

**使用前提：**

![UTOOLS1562828013262.png](https://i.loli.net/2019/07/11/5d26dcef441eb74354.png)
