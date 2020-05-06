# VUE搭建环境

## 一、安装node.js





## 二、安装vue的脚手架

npm install --global vue-cli



## 三、创建项目

vue init webpack 项目名字



init后不选择 eslint，其他任意



cd 项目名字

cnpm install / npm install 

npm run dev



##  四、引入需要依赖

### 1.axios

#### 1）安装

cnpm install axios --save



#### 2）在使用的地方引入

```javascript
<script>
    import axios from 'axios';
</script>
```



import axios from 'axios';



#### 3）可在main.js配置中进行全局设置

```js
//引入axios
import axios from 'axios';
axios.defaults.baseURL = "http://localhost:8082";
axios.interceptors.request.use(function (config) {
  // Do something before request is sent
  config.headers={
    'Content-Type': 'application/json',
    'Authorization' : Cookies.get('Authorization')
  }
  return config;
}, function (error) {
  // Do something with request error
  return Promise.reject(error);
});
```

### 2. element-ui

#### 1）安装

cnpm install element-ui --save

#### 2）配置webpack.config.js

在webpack.config.js中找到



```javascript
{
    test: /\.(png|jpg|gif|svg)$/,
    loader: 'file-loader',
         options: {
         name: '[name].[ext]?[hash]'
    }
}
```

在下方添加

```javascript
{
    test: /\.(eot|svg|ttf|woff|woff2)(\?\S*)?$/,
        loader: 'file-loader'
},
```



添加后的代码如下。不要添加错位置。

```javascript
{
  test: /\.(png|jpg|gif|svg)$/,
  loader: 'file-loader',
  options: {
    name: '[name].[ext]?[hash]'
  }
},
{
  test: /\.(eot|svg|ttf|woff|woff2)(\?\S*)?$/,
  loader: 'file-loader'
},
```





#### 3）在main.js中引入element

```javascript
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';

Vue.use(ElementUI);
```



### 3.js-cookie

#### 1）安装

cnpm install js-cookie --save

#### 2）在使用的页面中引入

import Cookies from 'js-cookie'



### 4.在idea中使用vue(选)

file->settings->plugins->查找vue.js->安装重启idea

file->settings->Editor->File and Code Templates->添加Vue模板



# 需掌握知识点

## 一、基本语法

v-if-else，v-for，v-html，v-text等基础语法掌握，

使用数据场景，数据绑定，数据引用：{{xx}}与v-bind，

知道语法的简化写发，例入v-bind简写与v-on简写：:xxx与@xxx。

## 二、获取事件和mvvm

v-model进行m-v,v-m的双向绑定。





通过组件上自定义传值与事件传值：下例能获取data-aid中的值，并且通过$event获取触发事件。

```html
<button data-aid='123' @click="eventFn($event)">事件对象</button>
<script>
eventFn(e){
	console.log(e);
	e.srcElement.style.background='red';
	console.log(e.srcElement.dataset.aid);
}
</script>
```

## 三、挂载组件，请求数据的方法

创建组件之后，在script中引入，并在components中绑定组件

```javascript
<!--挂载卸载组件，三种方法请求数据
    Home
-->
<template>
    <div id="app">
        <h2>{{msg}}</h2> 
        <v-home></v-home>
        <hr><br>
        <v-news></v-news>
    </div>
</template>

<script>
    /*
        1、引入组件
        2、挂载组件
        3、在模板中使用
     */
    import Home from './components/Home.vue'
    import News from './components/News.vue'
    export default {
        data(){
            return{
                msg:"我是根组件"
            }
        },
        components:{
            'v-home': Home,
            'v-news': News
        }
    }
</script>
```



我知道的请求数据有三种模板

- vue-resource
- axios
- fetch-jsonp

vue-resource只需要安装之后，在main.js中引入，全局使用通过`this.$http`，引用对象使用`Vue.http`。

axios相对vue-resource则需要在需要使用的地方进行引入。

[点击查看文章更多关于两者的区别](https://blog.csdn.net/super_ld/article/details/80714771)



## 四、组件间传值

### 1. 父给子组建传值

### ２.父组件主动获取子组建的数据和方法

### 3.子组建主动获取子组件的数据和方法

### 4.非父子组建间传值



## 五、生命周期方法

了解关于生命周期的方法

```javascript
<script>
export default {
    data() {
        return {
            msg:'你好vue'
        }
    },
    beforeCreate() {
        console.log('实例创建之前')
    },
    created() {
        console.log('实例创建完成')
    },
    beforeMount() {
        console.log('模板编译之前')
    },
    mounted() {
        console.log('模板编译完成')
    },
    beforeUpdate() {
        console.log('数据更新之前')
    },
    updated() {
        console.log('数据更新完毕')
    },
    beforeDestroy() {
        console.log("实例销毁之前")
    },
    destroyed() {
        console.log('实例销毁完成')
    },
}
</script>
```



## 六、路由

我理解上：路由实际上相当于跳转页面的地址集合别名绑定。

在使用路由之前，需要在main.js中引入所需要构建路由的页面，并引入`vue-router`，然后再定义路由后将路由实例化，最后在创建Vue的时候，将路由实例作为参数传入。



然后，路由也分为静态路由和动态路由，静态路由的url是固定的，而动态路由可通过`/:xxx`来对这个url中的某个部分进行不固定声明。下例代码，就是传入了Home,News,Content,Pcontent四个页面。并设置home为默认跳转页面。



注：`/content/:aid`中使用的是动态路由。

```javascript
// 引入组件
import VueRouter from 'vue-router';
Vue.use(VueRouter);

import Home from './routeComponents/Home.vue';
import News from './routeComponents/News.vue';
import Content from './routeComponents/Content.vue';
import PContent from './routeComponents/Pcontent.vue';
// 定义路由
const routes=[
  {path:'/home',component:Home},
  {path:'/news',component:News},
  {path:'/content/:aid',component:Content},/**动态路由/:id */
  {path:'/pcontent',component:PContent},
  {path:'*',redirect:'/home'}//默认跳转路由
]
// 实例router
const router = new VueRouter({
  routes  //相当于routes:routes
})

new Vue({
  el: '#app',
  router,//router使用
  render: h => h(App)
})
```



### 1.静态路由

在使用静态路由时，直接在`template>div`中写入`router-link`组件来使用已定义好的路由。

```html
<router-link to='/home'>首页</router-link>
<router-link to='/news'>新闻</router-link>
```



### 2.动态路由

在使用动态路由时，在`router-link`中，在`/url`后填入需要动态填入的值，如下方使用的aid。

```html
<ul class="list">
    <li v-for="(item, key) in list" :key="key">
        <router-link :to="'/content/'+item.aid">
            {{key}}---{{item.title}}</router-link>
    </li>
</ul>
```

### 3.get传值

动态路由的目的是获取页面传值，在不使用动态路由时，`router-link`中也能使用get方法传值，如下，`?aid=xxx`就是将aid传到另一页面中。

```javascript
<router-link :to="'/pcontent?aid='+key">{{key}}---{{item}}</router-link>
```

### 4. this.$route与this.$router的区别

$route表示当前路由信息对象。而

$router表示的是router的全局路由实例。

[参考](https://www.jianshu.com/p/fa0b5d919615)

### 5. 编程式导航(js跳转路由)



有两种用法，一种是直接使用path，一种用name

#### 1）path跳转

使用path进行跳转

```javascript
//第一种使用path
this.$router.push({path:'news'});

this.$router.push({path:'content/495'});//使用动态路由也可以


this.$router.push({name:'news'})//命名路由跳转
```

#### 2）name跳转

使用name进行跳转前，要在定义路由处添加name属性。

```javascript
//第二种使用name
//在使用name时需要在定义路由的时候，添加name属性
{path:'/news',component:News,name:'news'},
```

#### 3）携带参数

使用编程式路由时，也可以携带参数，但是两者携带参数的方式各有限制。

使用name的时候，使用params:对象传递参数。

使用path时，使用query:对象携带参数。

```javascript
router.push({ name: 'news', params: { userId: '123' }})

// 带查询参数，变成 /register?plan=private
router.push({ path: '/news', query: { userId: '123' }})
```

### 6.嵌套路由

添加children:[]，在父路由页面中添加router-view与router-link

```javascript
{
    path:'/user',
        component:User,
            children:[
                {path:'addUser',component:UserAdd},
                {path:'userList',component:UserList}
            ]
},
```

