export class RootRoute {
    public screenType: number | string;
    public params: any;
    constructor(screenType: number | string, params?: any) {
        this.screenType = screenType;
        this.params = params;
    }
}
