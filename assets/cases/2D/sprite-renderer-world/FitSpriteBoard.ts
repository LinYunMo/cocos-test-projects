import { _decorator, Camera, Component, screen } from 'cc';

const { ccclass, requireComponent } = _decorator;

@ccclass('FitSpriteBoard')
@requireComponent(Camera)
export class FitSpriteBoard extends Component {
    protected onEnable () {
        this.fit();
        screen.on('window-resize', this.fit, this);
    }

    protected onDisable () {
        screen.off('window-resize', this.fit, this);
    }

    private fit () {
        const { width, height } = screen.windowSize;
        if (width > 0 && height > 0) {
            this.getComponent(Camera)!.orthoHeight = Math.max(5.05, 8.08 * height / width);
        }
    }
}
