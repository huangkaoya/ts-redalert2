import { TileCollection, TileDirection } from '../map/TileCollection';
export class AutoLat {
    static calculate(tiles: TileCollection, tileData: any) {
        const tileSetMap = new Map();
        tiles.forEach((tile) => {
            let setNum = tileData.getSetNum(tile.tileNum);
            tileSetMap.set(tile, setNum);
            if (tileData.isCLAT(setNum)) {
                setNum = tileData.getLAT(setNum);
                tileSetMap.set(tile, setNum);
                tile.tileNum = tileData.getTileNumFromSet(setNum);
            }
        });
        tiles.forEach((tile) => {
            const setNum = tileSetMap.get(tile);
            if (tileData.isLAT(setNum)) {
                let connectionFlags = 0;
                const topRight = tiles.getNeighbourTile(tile, TileDirection.TopRight);
                const bottomRight = tiles.getNeighbourTile(tile, TileDirection.BottomRight);
                const bottomLeft = tiles.getNeighbourTile(tile, TileDirection.BottomLeft);
                const topLeft = tiles.getNeighbourTile(tile, TileDirection.TopLeft);
                if (topRight && tileData.canConnectTiles(setNum, tileSetMap.get(topRight)))
                    connectionFlags += 1;
                if (bottomRight && tileData.canConnectTiles(setNum, tileSetMap.get(bottomRight)))
                    connectionFlags += 2;
                if (bottomLeft && tileData.canConnectTiles(setNum, tileSetMap.get(bottomLeft)))
                    connectionFlags += 4;
                if (topLeft && tileData.canConnectTiles(setNum, tileSetMap.get(topLeft)))
                    connectionFlags += 8;
                if (connectionFlags > 0) {
                    const clatSet = tileData.getCLATSet(setNum);
                    tile.tileNum = tileData.getTileNumFromSet(clatSet, connectionFlags);
                }
            }
            else if (setNum === tileData.getGeneralValue("RampBase") &&
                !(tile.rampType < 1 || tile.terrainType > 4)) {
                let smoothFlags = -1;
                const topRight = tiles.getNeighbourTile(tile, TileDirection.TopRight);
                const bottomRight = tiles.getNeighbourTile(tile, TileDirection.BottomRight);
                const bottomLeft = tiles.getNeighbourTile(tile, TileDirection.BottomLeft);
                const topLeft = tiles.getNeighbourTile(tile, TileDirection.TopLeft);
                switch (tile.rampType) {
                    case 1:
                        if (topLeft && topLeft.rampType === 0)
                            smoothFlags++;
                        if (bottomRight && bottomRight.rampType === 0)
                            smoothFlags += 2;
                        break;
                    case 2:
                        if (topRight && topRight.rampType === 0)
                            smoothFlags++;
                        if (bottomLeft && bottomLeft.rampType === 0)
                            smoothFlags += 2;
                        break;
                    case 3:
                        if (bottomRight && bottomRight.rampType === 0)
                            smoothFlags++;
                        if (topLeft && topLeft.rampType === 0)
                            smoothFlags += 2;
                        break;
                    case 4:
                        if (bottomLeft && bottomLeft.rampType === 0)
                            smoothFlags++;
                        if (topRight && topRight.rampType === 0)
                            smoothFlags += 2;
                        break;
                }
                if (smoothFlags !== -1) {
                    tile.tileNum = tileData.getTileNumFromSet(tileData.getGeneralValue("RampSmooth"), 3 * (tile.rampType - 1) + smoothFlags);
                }
            }
        });
    }
}
