sub main()
    screen=CreateObject("roScreen", true)
    screen.SetAlphaEnable(true)
    screen.Clear(&HC0C0C0FF)
    compositor=CreateObject("roCompositor")
    compositor.SetDrawTo(screen, 0)
    roku = CreateObject("roBitmap", "pkg:/img/roku-logo.png")
    logo = CreateObject("roBitmap", "pkg:/img/sprite.png")
    ball = CreateObject("roBitmap", "pkg:/img/AmigaBoingBall.png")
    rgn1 = CreateObject("roRegion", ball, 0, 0, ball.getWidth(), ball.getHeight())
    rgn2 = CreateObject("roRegion", logo, 0, 0, logo.getWidth(), logo.getHeight())
    rgn3 = CreateObject("roRegion", roku, 100, 100, 100, 100)
    compositor.NewSprite(0, 0, rgn1, 20)
    compositor.NewSprite(30, 70, rgn2, 10)
    compositor.NewSprite(60, 60, rgn3,40)
    compositor.DrawAll()
end sub