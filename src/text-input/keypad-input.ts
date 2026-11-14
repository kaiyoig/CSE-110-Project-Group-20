import Konva from "konva";

export default class KeypadInput extends Konva.Group {

    //sends pressed key into puzzle
    public onKeyPressed?: (key: string) => void;
    private readonly answerDisplay: Konva.Text;
    public onSubmit?: () => void;

    constructor(){
        super({
            visible: false,
            name: "keypad-input"
        });

        const displayBackground = new Konva.Rect({
            x: 0,
            y: 0,
            width: 200,
            height: 50,
            fill: "#ffffff",
            stroke: "#38255D",
            strokeWidth: 2,
            cornerRadius: 10
        });

        this.answerDisplay = new Konva.Text({
            x: 0,
            y: 0,
            width: 200,
            height: 50,
            text: "Enter answer",
            fontSize: 24,
            align: "center",
            verticalAlign: "middle",
            fill: "#38255D",
            listening: false
        });

        this.add(displayBackground, this.answerDisplay);
        const keypadBackground = new Konva.Rect({
            x: -12,
            y: 53,
            width: 224,
            height: 314,
            fill: "#FFDA47",
            stroke: "#38255D",
            strokeWidth: 4,
            cornerRadius: 24,
            shadowColor: "#38255D",
            shadowBlur: 0,
            shadowOffsetY: 6,
            shadowOpacity: 1,
            listening: false
        });

        this.add(keypadBackground);

        const keys = [
            "1", "2", "3",
            "4", "5", "6",
            "7", "8", "9",
            "-", "0", "/",
            "C", "⌫"
        ];

        keys.forEach((key, index) => {
            //Remainder gives value 0, 1, 2, giving us 3 possible x values for button
            const x = (index % 3) * 70;
            //Adds 60 after each 3rd entry by using floor and dividing 3
            const y = 65 + Math.floor(index / 3) * 60;

            const button = new Konva.Group({ x, y });   
            
            const background = new Konva.Rect({
                width: 60,
                height: 50,
                fill: "#F9F9FB",
                stroke: "#38255D",
                strokeWidth: 3,
                cornerRadius: 10
            });

            const label = new Konva.Text({
                width: 60,
                height: 50,
                text: key,
                fontSize: 26,
                align: "center",
                verticalAlign: "middle",
                fill: "#38255D",
                listening: false
            });

            button.add(background, label)

            button.on("click tap", () => {
                this.onKeyPressed?.(key)
            });

            this.add(button);
        });

        const submitButton = new Konva.Group({
            x: 0,
            y: 390
        });

        const submitBackground = new Konva.Rect({
            width: 200,
            height: 50,
            fill: "#38255D",
            cornerRadius: 10
        });

        const submitText = new Konva.Text({
            width: 200,
            height: 50,
            text: "Submit",
            fontSize: 24,
            align: "center",
            verticalAlign: "middle",
            fill: "#ffffff",
            listening: false
        });

        submitButton.add(submitBackground, submitText);

        submitButton.on("click tap", () => {
            this.onSubmit?.();
        });

        this.add(submitButton);
    }

    public setAnswer(answer: string): void {
    this.answerDisplay.text(answer || "Enter answer");
    this.getLayer()?.batchDraw();

}
}   