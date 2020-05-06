# java class

[参考](https://www.cnblogs.com/hvicen/p/6261878.html)

- 判断

  - isPrimitive():boolean
    查看是否基本数据类型。
  - isArray():boolean
    查看是否数组类型。
  - isInterface():boolean
    查看是否接口类型。
  - isAnnotation():boolean
    查看是否注解类型。
  - isEnum():boolean
    查看是否枚举类型。

  - isPrimitive():boolean 

    是否为八个基础类型

  - isMemberClass():boolean
    查看是否成员内部类。

  - isLocalClass():boolean
    查看是否局部内部类。

  - isAnonymousClass():boolean
    查看是否匿名内部类。

  - desiredAssertionStatus():boolean
    测试该类的断言功能是否已打开。

- 获取类，类部类，类方法，类字段

  - getClasses():Class<?>[]

    获取public的内部类

  - getDeclaredClasses():Class<?>[]

    获取除父类的所有内部类

  - getConstructor(Class<?>...):Constructor<T>

    根据参数获取public构造方法

  - getConstructors():Constructor<?>[]

    获取所有public构造方法

  - getDeclaredConstructor(Class<?>...):Constructor<T>

    根据参数获取构造方法

  - getDeclaredConstructors():Constructor<?>[]

    获取所有构造方法

  - getMethod(String, Class<?>...):Method

    根据方法名和参数获取public方法

  - getMethods():Method[]

    获取所有的public方法

  - getDeclaredMethod(String, Class<?>...):Method

    根据方法名和参数获取方法

  - getDeclaredMethods():Method[]

    获取所有方法

  - getField(String):Field

    根据字段名获取public字段

  - getFields():Field[]

    获取所有public字段

  - getDeclaredField(String):Field

    根据字段名获取字段

  - getDeclaredFields():Field[]

    获取所有字段

  - getComponentType():Class<?>
    该类为数组类型时，可通过此方法获取其组件类型。

  - getEnumConstants():T[]
    该类为枚举类型时，可通过此方法获取其所有枚举常量。

  - getDeclaringClass():Class<?>
    获取成员内部类在定义时所在的类。

  - getEnclosingClass():Class<?>
    获取内部类在定义时所在的类。

  - getEnclosingConstructor():Constructor
    获取局部或匿名内部类在定义时所在的构造器。

  - getEnclosingMethod():Method
    获取局部或匿名内部类在定义时所在的方法。

  - asSubclass(Class<U>):Class<? extends U>
    把该类型(子类)转换为目标类型(父类)。

  - isAssignableFrom(Class<?>):boolean
    测试该类型(父类)是否为目标类型(子类)的父类。

- 实例

  - newInstance():T
    使用该类的无参构造器创建实例。
  - isInstance(Object):boolean
    测试该对象实例是否为该类的实例。
  - cast(Object):T
    把对象实例转为该类的实例。

- 获取该类继承父类，实现接口相关

  - getSuperclass():Class<? super T>
    获取直接继承的父类。（无泛型参数）

  - getGenericSuperclass():Type

    返回直接继承父类。（包含泛型参数）

  - getAnnotatedSuperclass():AnnotatedType

    返回直接继承父类时使用的注解

  - getInterfaces():Class<?>[]
    获取实现的接口集。（无泛型参数）

  - getGenericInterfaces():Type[]

    获取实现的接口集。（有泛型参数）

  - getAnnotatedInterfaces():AnnotatedType[]

    返回直接实现接口时使用的注解

- 类相关包和资源

  - getPackage():Package
    获取类在定义时所在的包。
  - getResource(String):URL
    获取与该类所在目录下的路径资源。
  - getResourceAsStream(String):InputStream
    以流的方式获取该类所在目录下的路径资源



