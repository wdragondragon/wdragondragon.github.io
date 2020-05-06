# 一、linux redis搭建环境

分为docker安装和官网下载手动安装，docker就不描述了

## 1. 下载

[官网redis下载](https://redis.io/)



下载获得redis-版本号.tar.gz后将它放入我们的Linux目录/opt

/opt目录下，解压命令:tar -zxvf redis-版本号.tar.gz

解压完成后出现文件夹：redis-版本号，进入目录:cd redis-版本号



##　２. make

- 进入该目录之后执行make，无错误就直接过，但可能会遇到gcc没有安装的情况，

  安装gcc：sudo apt install build-essential

- 第一次错误出现后，再进行make，会出现Jemalloc/jemalloc.h：没有那个文件或目录，这是因为第一次make留下的残留文件，这时可以运行make distclean之后再make

- make通过后执行make install，显示全部install即可



## 3. 安装目录

查看默认安装目录：usr/local/bin

Redis-server：Redis服务器启动命令 -> redis-server /配置路径/配置文件

Redis-cli：客户端，操作入口

Redis-benchmark:性能测试工具，可以在自己本子运行，看看自己本子性能如何

Redis-check-dump：修复有问题的dump.rdb文件

Redis-check-aof：修复有问题的AOF文件

Redis-sentinel：redis集群使用



## 4. 运行前的配置

- 在之前压缩包里，将redis.conf拷贝到任意目录下，我是拷贝到/myredis/redis.conf下。
- 然后不动原有配置，直接改动拷贝的配置文件。将daemonize no改为yes，守护进程开启，才能在后台运行。
- 在安装目录下运行redis-server：redis-server /myredis/redis.conf



## 5. 客户端连通测试

### 1）本地连通测试

- 在安装目录下运行redis-cli：redis-cli -p 6379
- 进行连通测试，ping。收到pong则成功。

### 2）外部连通测试

现在暂时使用的是虚拟机作为redis-server，而在物理机中使用redis-client。这相当于在局域网当中进行联通。

- 这个时候需要修改配置文件中的bind:127.0.0.1，这代表着该redis服务只能允许本地的client进行连接，将他修改为0.0.0.0为允许所有主机。

- 然后本地防火墙开放6379端口

  ```shell
  firewall-cmd --add-port=6379/tcp --permanent
  #执行成功后返回success，--permanent代表永久有效
  firewall-cmd --query-port=6379/tcp
  #如果开启6379成功的话，返回yes
  ```

- 用ifconfig获取虚拟机的ip，在外部使用RedisDesktopManager连接虚拟机中的redis即可成功。



## 6. 设置访问密码

### 1）方法一、修改配置文件

进入到redis.conf配置文件中取消注释requirepass并在后面改成自己想要的密码
requirepass 123456

需要重启生效

### 2）方法二、client中修改config

连通后，可以获取到config中的密码，使用`config get requirepass`

当然也能修改密码`config set requirepass 123456`

立即生效



### 3）密码验证

连通后，`auth 123456`才能输入指令，不然会被拒绝访问



# 二、redis知识点

## 1. 基本通用指令

Select命令切换数据库

Dbsize查看当前数据库的key的数量

Flushdb：清空当前库

Flushall；通杀全部库

## 2. 键+数据类型（5+1）

### 1）key

- key * 输出所有键
- exists key的名字，判断某个key是否存在
- move key db   --->当前库就没有了，被移除了
- expire key 秒钟：为给定的key设置过期时间
- ttl key 查看还有多少秒过期，-1表示永不过期，-2表示已过期
- type key 查看你的key是什么类型

### 2）String

- set/get/del/append/strlen
- Incr/decr/incrby/decrby,一定要是数字才能进行加减
- getrange/setrange
- setex(set with expire)键秒值/setnx(set if not exist)
- mset/mget/msetnx
- getset(先get再set)

```shell
set k1 v1
#ok
get k1
#"v1"
```



### 3）Hash

- hset/hget/hmset/hmget/hgetall/hdel(单增取，多增取，删除)
- hlen 长度
- hexists key 在key里面的某个值的key
- hkeys/hvals 获取keyset/获取valueset
- hincrby/hincrbyfloat 数字加减
- hsetnx 先判断是否存在，不存在就进行hset



```shell
> hmset user:1000 username antirez birthyear 1977 verified 1
OK
> hget user:1000 username
"antirez"
> hget user:1000 birthyear
"1977"
> hgetall user:1000
1) "username"
2) "antirez"
3) "birthyear"
4) "1977"
5) "verified"
6) "1"
```



### 4）List

- lpush/rpush/lrange 左右入链，输出
- lpop/rpop 左右出链
- lindex，按照索引下标获得元素(从上到下)
- llen 长度
- lrem key 删N个value
- ltrim key 开始index 结束index，截取指定范围的值后再赋值给key
- rpoplpush 源列表 目的列表
- lset key index value 设置list的index下标的值
- linsert key  before/after 值1 值2



List可从rpush也能从lpush;

也可从rpop和lpop;

但输出只有lrange并没有rrange;

```shell
> rpush mylist A
(integer) 1
> rpush mylist B
(integer) 2
> lpush mylist first
(integer) 3
> lrange mylist 0 -1
1) "first"
2) "A"
3) "B"
```



### 5）Set

- sadd/smembers/sismember 增加/输出/检测成员
- scard，获取集合里面的元素个数
- srem key value 删除集合中元素
- srandmember key 某个整数(随机出几个数)
- spop key 随机出栈
- smove key1 key2 在key1里某个值      作用是将key1里的某个值赋给key2
- sdiff/sinter/sunion  差集/交集/并集 params:set1 set2

简单使用

```shell
127.0.0.1:6379> sadd myset 1 2 3
(integer) 3
127.0.0.1:6379> SMEMBERS myset
1) "1"
2) "2"
3) "3"
```



```shell
> sismember myset 3
(integer) 1
> sismember myset 30
(integer) 0
```

### 6）Zset

-  zadd/zrange/zrevrange 增加/从小到大输出/从大到小输出
-  zrangebyscore/zrevrangebyscore key 开始score 结束score （取范围score输出）
-  zrem key 某score下对应的value值，作用是删除元素
-  zcard/zcount key score区间/zrank key values值，作用是获得下标值/zscore key 对应值,获得分数
-  zrevrank key values值，作用是逆序获得下标值



根据增加score来进行排序的Set，正常的set指令为`sadd myset v1 v2 v3`

而Zset的指令为`zadd myZset score1 v1 score2 v2 score3 v3`

会根据这个score的从小大进行排序，如果相同则比较字符串，得出一个唯一的序列。



添加zset数据

```shell
> zadd hackers 1940 "Alan Kay"
(integer) 1
> zadd hackers 1957 "Sophie Wilson"
(integer 1)
> zadd hackers 1953 "Richard Stallman"
(integer) 1
> zadd hackers 1949 "Anita Borg"
(integer) 1
> zadd hackers 1965 "Yukihiro Matsumoto"
(integer) 1
> zadd hackers 1914 "Hedy Lamarr"
(integer) 1
> zadd hackers 1916 "Claude Shannon"
(integer) 1
> zadd hackers 1969 "Linus Torvalds"
(integer) 1
> zadd hackers 1912 "Alan Turing"
(integer) 1
```



使用zrange（从小到大）或zrevrange（从大到小）来输出他们，

```shell
> zrange hackers 0 -1
1) "Alan Turing"
2) "Hedy Lamarr"
3) "Claude Shannon"
4) "Alan Kay"
5) "Anita Borg"
6) "Richard Stallman"
7) "Sophie Wilson"
8) "Yukihiro Matsumoto"
9) "Linus Torvalds"
```

[五大类型更多使用详看官网](http://www.redis.cn/topics/data-types-intro.html)





## 3. 配置文件

配置文件分为几大块

### 1）Units单位

```shell
# Note on units: when memory size is needed, it is possible to specify
# it in the usual form of 1k 5GB 4M and so forth:
#
# 1k => 1000 bytes
# 1kb => 1024 bytes
# 1m => 1000000 bytes
# 1mb => 1024*1024 bytes
# 1g => 1000000000 bytes
# 1gb => 1024*1024*1024 bytes
#
# units are case insensitive so 1GB 1Gb 1gB are all the same.
```

配置大小单位，开头有定义一些基本的单位，只支持使用bytes定义，不支持bit，并且对大小写不敏感。

### 2）INCLUDES包含

可以将配置拆分成细小的配置文件，然后通过总配置文件将其他配置文件包含进来。格式`include /path`

### 3）GENERAL通用

| 名              | 描述                                                         | 默认               |
| --------------- | ------------------------------------------------------------ | ------------------ |
| daemonize       | 守护进程                                                     | no                 |
| pidfile         | 以守护进程启动时创建的pid文件路径                            | /var/run/redis.pid |
| port            | 运行的端口号                                                 | 6379               |
| tcp-backlog     | 设置tcp的backlog最大长度，backlog队列总和=未完成三次握手队列 + 已经完成三次握手队列 | 511                |
| Timeout         | 定时关闭连接                                                 | 0                  |
| bind            | 允许ip连接                                                   | 127.0.0.1          |
| Tcp-keepalive   | 单位为秒，如果设置为0，则不会进行Keepalive检测，建议设置成60 | 0                  |
| Loglevel        | 日志等级                                                     | notice             |
| Logfile         | 日志文件路径                                                 | ""                 |
| Syslog-enabled  | 是否启动系统日志                                             | no                 |
| Syslog-ident    | 系统日志标志                                                 | redis              |
| Syslog-facility | 输入日志的设备                                               | local0             |
| Databases       | 库的数量                                                     | 16                 |



### 4）SNAPSHOTTING快照



| 名                          | 描述                          | 默认                                         |
| --------------------------- | ----------------------------- | -------------------------------------------- |
| save                        | save 秒钟 写操作次数          | save 900 1<br/>save 120 10<br/>save 60 10000 |
| stop-writes-on-bgsave-error | save出错时停止写              | yes                                          |
| rdbcompression              | 是否使用LZF压缩快照           | yes                                          |
| rdbchecksum                 | 是否使用CRC64算法进行数据校验 | yes                                          |
| dbfilename                  | 持久化rdb的文件名称           | dump.rdb                                     |
| dir                         | 文件根目录                    | ./                                           |



### 5）REPLICATION复制

| 名                       | 描述                         | 默认 |
| ------------------------ | ---------------------------- | ---- |
| replica serve stale data | 主从复制中是否响应客户端请求 | yes  |
| replica-read-only        | slave端是否只能读不能写      | yes  |



### 6）SECURITY安全

| 名          | 描述          | 默认 |
| ----------- | ------------- | ---- |
| requirepass | redis访问密码 | ""   |



### 7）LIMITS限制

| 名                | 描述                                    | 默认         |
| ----------------- | --------------------------------------- | ------------ |
| Maxclients        | 设置redis同时可以与多少个客户端进行连接 | 10000        |
| Maxmemory         | 设置redis可以使用的内存量               | 0            |
| Maxmemory-policy  | 达到最大内存量时使用什么算法移除key     | volatile-lru |
| Maxmemory-samples | 设置样本数量                            | 5            |



### 8）APPEND ONLY MODE追加

| 名                        | 描述                          | 默认             |
| ------------------------- | ----------------------------- | ---------------- |
| appendonly                | 是否开启aof                   | no               |
| appendfilename            | aof文件名                     | "appendonly.aof" |
| Appendfsync               | 同步策略                      | everysec         |
| No-appendfsync-on-rewri   | 重写时是否可以运用appendfsync | no               |
| Auto-aof-rewrite-min-size | 设置重写的基准值              | 64m              |
| Auto-aof-rewrite-percenta | 设置重写的基准值              | 100              |



## 4.持久化

### 1）RDB(Redis DataBase)

在指定时间内将数据集快照写入磁盘，在上面配置文件中SNAPSHOTTING中的save属性就是配置RDB的快照频率。



`save 900 1` `save 300 10` `save 60 100`，意味着60秒内进行100次修改操作就进行一次快照。300秒内10次，900秒内1次。



并且保存的文件默认为启动的dump.rdb。



使用save和bgsave能立即进行快照。不同在于bgsave是异步执行

### 2）AOF(Append Only File)

需要手动启动，将appendonly从no改为yes



与RDB不同，AOF中是记录所有操作而并非数据集，在运行redis-server以后，会将aof文件中的操作重新执行一遍。



在配置文件中APPEND ONLY MODE下的重写基准可以设置在文件达到多少级别时进行重写。这会将添加之后再删除的数据操作进行约分扣除。



从配置文件中的Auto-aof-rewrite-min-size与Auto-aof-rewrite-percenta可知rewrite触发机制：`redis会记录上次重写时的AOF大小，默认配置是当AOF文件大小是上次rewrite后大小的一倍且文件大于64M时触发`



### 3）机制

在rdb与aof中被恶意插入一些不可被redis识别的语句时，可以执行安装目录下的`redis-check-aof --fix`与`redis-check-dump --fix`来修复。



在rdb与aof同时启动时，会优先使用aof，如果aof文件损坏，则redis启动会报错。



相同数据集的数据而言aof文件要远大于rdb文件，恢复速度慢于rdb，Aof运行效率要慢于rdb,每秒同步策略效率较好，不同步效率和rdb相同

## 5.redis事务

redis的事务和数据库中的事务不太一致，在redis事务中，是将所有的操作进行入队，然后再进行全部出队执行。而不是执行一项后再进行下一项。

### 1）正常执行

使用multi后执行入队操作，最后使用exec执行事务

```shell
127.0.0.1:6379> get balance
"100"
127.0.0.1:6379> get dept
"0"
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379> DECRBY balance 10
QUEUED
127.0.0.1:6379> INCRBY dept 10
QUEUED
127.0.0.1:6379> EXEC
1) (integer) 90
2) (integer) 10
```



### 2）放弃事务

使用discard放弃事务

```shell
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379> decrby balance 100
QUEUED
127.0.0.1:6379> DISCARD
OK
127.0.0.1:6379> get balance
"90"
```



### 3）回滚

在事务中某个操作具有语法错误，不可执行的情况下。事务会全部作废不会生效。

因为redis的事务为入队后出队执行，所以在redis中入队时识别到语法具有错误，进行的回滚，并不是真正的回滚，只是不执行事务。



```shell
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379> decrby balance 20
QUEUED
127.0.0.1:6379> set error
(error) ERR wrong number of arguments for 'set' command
127.0.0.1:6379> exec
(error) EXECABORT Transaction discarded because of previous errors.
```



### 4）指明错误

在事务中某个操作是可执行的，但会报错的操作时，事务不会回滚，只会提示哪一步错误。

```shell
127.0.0.1:6379> set string s1
OK
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379> decrby balance 20
QUEUED
127.0.0.1:6379> decrby string 20
QUEUED
127.0.0.1:6379> incrby dept 20
QUEUED
127.0.0.1:6379> EXEC
1) (integer) 70
2) (error) ERR value is not an integer or out of range
3) (integer) 30
```



### 5）watch监控

使用`watch key`来监控某个值在事务的过程中是否被别的client修改。

watch指令类似乐观锁，所以watch之后，在exec之前，别的客户端是能够进行修改的。只有在最后exec之后，进行判断版本时，发现被修改后会报错，事务需要重新入队，重新执行。

通过WATCH命令在事务执行之前监控了多个Keys，倘若在WATCH之后有任何Key的值发生了变化，

EXEC命令执行的事务都将被放弃，同时返回Nullmulti-bulk应答以通知调用者事务执行失败

## 6.主从复制

主从复制遵循配从不配主，意思是，主机不进行任何配置的情况下，可以被小弟(slave从机)加入。

### 1）复制操作

自己本地单机实验时，需要拷贝多个redis.conf文件给从机，并且port,rdb,aof,log文件配置需要与主机不同并开启daemonize，使得其与主机的生成文件不同。



配置好之后，开启主机与从机，在刚启动两台服务时，使用`info replication`指令都能看到`role:master`



在从机中使用指令`slaveof 127.0.0.1 6379`，再使用`info replication`会发现角色变为了slave。这时，主机中添加了记录，在从机中会拷贝过去。



注：因为配置了从机的replica-read-only，所以在变为从机时，只可读不可写。



### 2）复制原理

- Slave启动成功连接到master后会发送一个sync命令
- Master接到命令启动后台的存盘进程，同时收集所有接收到的用于修改数据集命令，
  在后台进程执行完毕之后，master将传送整个数据文件到slave,以完成一次完全同步
- 全量复制：而slave服务在接收到数据库文件数据后，将其存盘并加载到内存中。
- 增量复制：Master继续将新的所有收集到的修改命令依次传给slave,完成同步
- 但是只要是重新连接master,一次完全同步（全量复制)将被自动执行



### 3）哨兵模式(sentinel)

在主从模式中，如果主机宕机时，那么从机会原理待命不动，这时候需要哨兵模式监督从机进行投票选举，选出一个新的master机器。



在配置文件目录下新建`sentinel.conf`，一定不能打错字。



打开新建的哨兵配置文件，在下面填写内容` sentinel monitor 被监控数据库名字(自己起名字) 127.0.0.1 6379 1`，这里的1指的是，当从机获得多少票时，自动上位为master。



注：当原有的master回归后，其角色也为master，但他属于“光杆司令”，并没有从机再去恢复为他的slave。