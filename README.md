# 我编写的油猴脚本

## 自动封禁装置，启动！
### autoban.js

#### bilibili广告封禁脚本，针对日益猖狂的广告君开发此脚本
毕竟是基于相似度进行封禁的，可能存在误封、漏封的情况，请及时查看封禁信息避免误封
语料库功能还不完善，请谨慎使用，不同方法所使用的语料库均不同

菜单指令 开发者工具（console）中使用

- showStatus()  查看运行情况
- showBan()     查看封禁情况
- clearUID(uid)  根据指定uid删除ban_db中数据
- addCorpus()   将当前ban_db中每个uid的第一条发言不重复的放入当前语料库中

相关配置均在脚本内进行修改即可，基础功能开箱即用。
