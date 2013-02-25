# [RubyClientSide]()

The aim of **RubyClientSide** is to enable the use of Ruby in the client side of a web application.
The ruby parser/compiler is taken from the Opal project.
Instead of compiling a Ruby code to Javascript with a native compiler, we use a Javascript compiler.
This is only a proof of concept: coffeescript or Opal should be used to develop "serious" web application :) .

##Simple inheritance in a web page

In Ruby it is very easy to perform inheritance easily.
One would say that "classic inheritance" is not the prototype way to do, but I find it quite useful.
To do so, it is possible to write Ruby classes, and to embed it in you code as follow:
```
<script type="text/ruby">
      
  class Foo
    attr_accessor :name

    def method1
      return "result of Foo.method1!"
    end

    def method2
      return "result of Foo.method2!"
    end
  end

  class Bar < Foo
    def method2
      return "result of Bar.method2!"
    end
  end

</script>
```

## Calling javascript from Ruby

Now if you want to call javascript from a ruby script, you would proceed as follow:
```
<script type="text/ruby">
      
  def func 
    return "result of a ruby function"
  end

  `console.log("now: "+#{Time.new()})`
  `document.body.innerHTML = #{func()};`

</script>
```

##Calling Ruby from Javascript

As you can call javascript from a ruby script, you can also call Ruby from Javascript. To do so, please proceed as follow:

```
<script type="text/javascript">
  class Foo
    def bar
      puts "called bar on class Foo defined in ruby code"
    end
  end
</script>

  ...

<script type="text/javascript">
      
  Ruby.Foo.$new().$bar();

</script>
```

    
