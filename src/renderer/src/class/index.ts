import { ComponentType, BasicSymbol, RectType, LineType, TriangleType , TextType } from "./types";

class Diagram {
  components: ComponentType[];
  #ctx: CanvasRenderingContext2D;
  #componentId: number;
  #pinId: number;

  constructor(ctx: CanvasRenderingContext2D) {
    this.components = [];
    this.#ctx = ctx;
    this.#componentId = 1;
    this.#pinId = 1;
  }

  addComponent(component: ComponentType) {
    this.components.push(component);
    component.id = this.#componentId;
    this.#componentId++;
    if (component.pins) {
      component.pins.forEach((pin) => {
        pin.id = this.#pinId;
        this.#pinId++;
      });
    }
  }

  removeComponent(component: ComponentType) {
    const index = this.components.indexOf(component);
    if (index !== -1) {
      this.components.splice(index, 1);
    }
  }

  getComponent(mouseX: number, mouseY: number): ComponentType | null {
    for (let i = this.components.length - 1; i >= 0; i--) {
      const component = this.components[i];
      if (this.isPointInComponent(mouseX, mouseY, component)) {
        return component;
      }
    }
    return null;
  }

  getPinId(mouseX: number, mouseY: number): number | null {
    for (const component of this.components) {
      for (const pin of component.pins) {
        if (this.isPointInPin(mouseX, mouseY, pin, component)) {
          return pin.id;
        }
      }
    }
    return null;
  }

  connectPin(pinId1: number, pinId2: number) {
    const component1 = this.getComponentByPinId(pinId1);
    const component2 = this.getComponentByPinId(pinId2);
    component1?.pins.forEach((pin1)=>{
      if(pin1.id === pinId1){
        component2?.pins.forEach((pin2)=>{
          if(pin2.id === pinId2){
            if(pin1.connectedId == undefined&&pin2.connectedId== undefined){
              pin1.connectedId = pin2.id
              pin2.connectedId = pin1.id
              this.#ctx.beginPath()
              this.#ctx.moveTo(component1.centerX+pin1.to_offsetX,component1.centerY+pin1.to_offsetY)
              this.#ctx.lineTo(component2.centerX+pin2.to_offsetX,component2.centerY+pin2.to_offsetY)
              this.#ctx.stroke()
            }
          }
        })
      }
    })
  }

  reSetPinId(){
    this.#pinId = 1
  }

  // Helper functions
  isPointInComponent(mouseX: number, mouseY: number, component: ComponentType): boolean {
    const x = mouseX - component.centerX;
    const y = mouseY - component.centerY;
    return Math.pow(x, 2) + Math.pow(y, 2) <= Math.pow(10, 2); // Assuming a radius of 10 for simplicity
  }

  isPointInPin(mouseX: number, mouseY: number, pin, component: ComponentType): boolean {
    const pinX = mouseX - (component.centerX + pin.to_offsetX);
    const pinY = mouseY - (component.centerY + pin.to_offsetY);
    return Math.pow(pinX, 2) + Math.pow(pinY, 2) <= Math.pow(5, 2); // Assuming pin radius is 5
  }

  getComponentByPinId(pinId: number): Component | null {
    for (const component of this.components) {
      for (const pin of component.pins) {
        if (pin.id === pinId) {
          return component;
        }
      }
    }
    return null;
  }

  getPinById(pinId) {
    for (const component of this.components) {
      for (const pin of component.pins) {
        if (pin.id === pinId) {
          return {position:{x: component.centerX + pin.to_offsetX, y: component.centerY+ pin.to_offsetY},connectedId:pin.connectedId};
        }
      }
    }
    return null;
  }

  render() {
    this.components.forEach(component => {
      if(component){
        component.draw(this.#ctx);
      }
    });

    this.components.forEach(component => {
      if (component.pins) {
        component.pins.forEach(pin => {
          if (pin.connectedId !== undefined) {
            const connectedPin = this.getPinById(pin.connectedId);
            if (connectedPin) {
              this.#ctx.beginPath();
              this.#ctx.moveTo(component.centerX + pin.to_offsetX, component.centerY + pin.to_offsetY);
              this.#ctx.lineTo(connectedPin.position.x, connectedPin.position.y);
              this.#ctx.stroke();
            }
          }
        });
      }
    });
  }
}


class Component implements ComponentType {
  type: "Component" = "Component";
  id: number | undefined;
  centerX: number;
  centerY: number;
  toolTip: BasicSymbol | undefined;
  pins: Array<{
    id: number | undefined;
    from_offsetX: number;
    from_offsetY: number;
    to_offsetX: number;
    to_offsetY: number;
    connectedId?: number;
  }>;
  symbols: BasicSymbol[];

  constructor(
    centerX: number,
    centerY: number,
    toolTip:BasicSymbol | undefined = undefined,
    pins: Array<{
      from_offsetX: number;
      from_offsetY: number;
      to_offsetX: number;
      to_offsetY: number;
      id?: number;
      connectedId?: number;
    }> = [],
    symbols: BasicSymbol[] = [],
    id: number | undefined = undefined
  ) {
    this.id = id;
    this.centerX = centerX;
    this.centerY = centerY;
    this.toolTip = toolTip;
    this.pins = pins.map(pin => ({
      ...pin,
      id: pin.id === undefined ? undefined : pin.id,
      connectedId: pin.connectedId === undefined ? undefined : pin.connectedId,
    }));
    this.symbols = symbols;
  }

  draw(ctx: CanvasRenderingContext2D) {

    ctx.fillStyle = 'green'
    ctx.strokeStyle = 'none'
    ctx.beginPath()
    ctx.arc(this.centerX, this.centerY, 1,0,Math.PI * 2)
    ctx.fill()

    this.symbols.forEach(symbol => symbol.draw(this.centerX,this.centerY,ctx));

    this.pins.forEach(pin => {
      ctx.beginPath();
      let bitX = 0
      let bitY = 0
      if (pin.to_offsetX - pin.from_offsetX > 0) {
        bitX = -2
      } else if (pin.to_offsetX - pin.from_offsetX < 0) {
        bitX = 2
      } else {
        if (pin.to_offsetY - pin.from_offsetY > 0) {
          bitY = -2
        } else {
          bitY = 2
        }
      }
      ctx.font = '10px Arial';
      
      if(!pin.connectedId){
        ctx.moveTo(this.centerX + pin.from_offsetX, this.centerY + pin.from_offsetY);
        ctx.lineTo(this.centerX + pin.to_offsetX + bitX, this.centerY + pin.to_offsetY + bitY);
        ctx.stroke();
        ctx.beginPath()
        ctx.arc(this.centerX + pin.to_offsetX, this.centerY + pin.to_offsetY, 2, 0, Math.PI * 2)
        ctx.fillText(pin.id!.toString(), this.centerX+pin.to_offsetX-3, this.centerY+pin.to_offsetY-8);
      }else{
        ctx.moveTo(this.centerX + pin.from_offsetX, this.centerY + pin.from_offsetY);
        ctx.lineTo(this.centerX + pin.to_offsetX, this.centerY + pin.to_offsetY);
        ctx.stroke();
      }
      ctx.stroke();
    });

    if(this.toolTip){
      this.toolTip.draw(this.centerX,this.centerY,ctx)
    }
    
  }

  addToolTip(toolTip:BasicSymbol){
    this.toolTip = toolTip
    toolTip.centerX = this.centerX
    toolTip.centerY = this.centerY
  }

  removeToolTip() {
    this.toolTip = undefined
  }

  changePos(mouseX:number,mouseY:number){
      this.centerX = mouseX
      this.centerY = mouseY
  }

  getPinById(pinId: number): { component: ComponentType, to_offsetX: number, to_offsetY: number } | null {
    for (const pin of this.pins) {
      if (pin.id === pinId) {
        return { component: this, to_offsetX: pin.to_offsetX, to_offsetY: pin.to_offsetY };
      }
    }
    return null;
  }

  addSymbol(symbol:BasicSymbol){
    this.symbols.push(symbol)
  }


  addPin(from_offsetX,from_offsetY,to_offsetX,to_offsetY){
    this.pins.push({
      from_offsetX,
      from_offsetY,
      to_offsetX,
      to_offsetY,
      id:undefined,
      connectedId:undefined,
    })
  }

}

// Implementing BasicSymbol and its subclasses
abstract class BasicSymbol implements BasicSymbol {
  centerX: number;
  centerY: number;
  abstract draw(centerX:number,centerY:number,ctx: CanvasRenderingContext2D): void;
  constructor(centerX: number, centerY: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    this.centerX = centerX;
    this.centerY = centerY;
  }
}

class Line extends BasicSymbol implements LineType {
  type: "Line" = "Line";
  from_offsetX: number;
  from_offsetY: number;
  to_offsetX: number;
  to_offsetY: number;

  constructor(from_offsetX: number, from_offsetY: number, to_offsetX: number, to_offsetY: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    super((from_offsetX + to_offsetX) / 2, (from_offsetY + to_offsetY) / 2, draw);
    this.from_offsetX = from_offsetX;
    this.from_offsetY = from_offsetY;
    this.to_offsetX = to_offsetX;
    this.to_offsetY = to_offsetY;
  }

  draw(centerX:number,centerY:number,ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.moveTo(centerX+this.from_offsetX, centerY+this.from_offsetY);
    ctx.lineTo(centerX+this.to_offsetX, centerY+this.to_offsetY);
    ctx.stroke();
  }

  preview(to_offsetX,to_offsetY){
    this.to_offsetX = to_offsetX
    this.to_offsetY = to_offsetY
  }

}

class Text extends BasicSymbol implements TextType {
  type: "Text" = "Text";
  offsetX: number;
  offsetY: number;
  show:boolean;
  content:string;
  constructor(offsetX:number, offsetY:number,show:boolean,content:string,draw?: (ctx: CanvasRenderingContext2D) => void){
    super(offsetX,offsetY,draw?draw:()=>{})
    this.offsetX = offsetX
    this.offsetY = offsetY
    this.show = show
    this.content = content
  }

  draw(centerX: number, centerY: number, ctx: CanvasRenderingContext2D): void {
    if (this.show && this.content) {
      ctx.font = '10px Arial';
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.content, centerX+this.offsetX, centerY+this.offsetY);
    }
  }

  preview(offsetX: number,offsetY:number){
    this.offsetX = offsetX
    this.offsetY = offsetY
  }

}

class Rect extends BasicSymbol implements RectType {
  type: "Rect" = "Rect";
  width: number;
  height: number;

  constructor(centerX: number, centerY: number, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    super(centerX, centerY, draw);
    this.width = width;
    this.height = height;
  }

  draw(centerX:number,centerY:number,ctx: CanvasRenderingContext2D) {
    ctx.rect(centerX + this.centerX - this.width / 2,centerY + this.centerY - this.height / 2, this.width, this.height);
    ctx.stroke();
  }

}

class Triangle extends BasicSymbol implements TriangleType {

  type: "Triangle" = "Triangle";
  width: number;
  height: number;

  constructor(centerX: number, centerY: number, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    super(centerX, centerY, draw);
    this.width = width;
    this.height = height;
  }

  draw(centerX:number,centerY:number,ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.moveTo(centerX+this.centerX, centerY+this.centerY - this.height / 2);
    ctx.lineTo(centerX+this.centerX - this.width / 2, centerY+this.centerY + this.height / 2);
    ctx.lineTo(centerX+this.centerX + this.width / 2, centerY+this.centerY + this.height / 2);
    ctx.closePath();
    ctx.stroke();
  }

}

export { Diagram, Line, Rect, Triangle, Component ,Text };