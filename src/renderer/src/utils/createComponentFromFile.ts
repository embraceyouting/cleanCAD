import { Text , Component } from '../class/index';
export default async function(componentData) {
    let { centerX, centerY, toolTip, pins, symbols } = componentData;
    // 创建symbols数组，并等待所有Promise解决
    const symbolInstances = await Promise.all(symbols.map(async (symbol) => {
        const moduleExports = await import('../class/index');
        const BasicSymbol = moduleExports[symbol.type];
        const currentBasicSymbolInstance = new BasicSymbol(
        symbol.from_offsetX,
        symbol.from_offsetY,
        symbol.to_offsetX,
        symbol.to_offsetY
        );
        return currentBasicSymbolInstance;
    }));
    // 创建Component实例
    let component
    if(toolTip){
        toolTip = new Text(toolTip.offsetX, toolTip.offsetY,toolTip.show,toolTip.content)
        component = new Component(centerX, centerY, toolTip, pins, symbolInstances);
    }else{
        component = new Component(centerX, centerY, undefined, pins, symbolInstances);
    }
    return component;
}