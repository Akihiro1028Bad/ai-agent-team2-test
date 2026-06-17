def greet(name):
    if not name:
        return "Hello, guest!"
    return "Hello, " + name[0].upper() + name[1:] + "!"
