import { clickhouse } from "@/db"
import { GetText } from '@/utils/GetText'
import { parseStringPromise } from 'xml2js'
import { lcMessagesPath, type GameVersion } from "../utils"

type XML<T> = {
  root: T
}

type ArenasList = {
  map: {
    id: string,
    name: string,
    isDevelopment?: string,
    isHangar?: string,
  }[]
}

type BoundingBox = {
  bottomLeft: string
  upperRight: string
}

type Gameplay = {
  minimap: string,
  winnerIfTimeout: string,
  winnerIfExtermination: string,
  boundingBox: BoundingBox,
  teamSpawnPoints: {
    [key: string]: string | { // team_X
      position: string | string[]
    }
  },
  teamBasePositions: {
    [key: string]: string | { // team_X
      [key: string]: string // position_X
    }
  },
  controlPoint: string | string[],
  pointsOfInterestUDO: {
    point: {
      position: string,
      type: string
    }[]
  }

}

type Arena = {
  name: string,
  description: string,
  boundingBox: BoundingBox,
  roundLength: string,
  vehicleCamouflageKind: string,
  minimap: string,
  gameplayTypes: {
    [key: string]: Partial<Gameplay>
  }
}

function vec2(str: string) {
  const [x, y] = str.split(' ')
  return { x: parseFloat(x), y: parseFloat(y) }
}

function bboxParser(bbox: BoundingBox) {
  const bottomLeft = vec2(bbox.bottomLeft)
  const upperRight = vec2(bbox.upperRight)
  return { bottomLeft, upperRight }
}


async function process(root: string, branch: string) {
  const data = await Bun.file(`${root}/sources/res/scripts/arena_defs/_list_.xml`).text()
  const i18n = new GetText(await Bun.file(`${root}/${lcMessagesPath(branch)}/arenas.po`).text())

  const arenas = await parseStringPromise(data, { explicitArray: false }) as XML<ArenasList>
  const result: {
    id: string,
    tag: string,
    name: string,
    season: string,
    gameplay: string,
    minimap: string,
    bbox: { bottomLeft: { x: number, y: number }, upperRight: { x: number, y: number } },
    winnerIfTimeout?: number,
    winnerIfExtermination?: number,
    base?: { team: number, positions: { x: number, y: number }[] }[],
    spawn?: { team: number, pos: { x: number, y: number }[] }[],
    control?: { x: number, y: number }[],
    poi?: { position: { x: number, y: number }, type: string }[]
  }[] = []

  for (const arena of arenas.root.map) {
    if (arena.isDevelopment || arena.isHangar) continue
    if (!await Bun.file(`${root}/sources/res/scripts/arena_defs/${arena.name}.xml`).exists()) continue

    const data = await Bun.file(`${root}/sources/res/scripts/arena_defs/${arena.name}.xml`).text()
    const meta = (await parseStringPromise(data, { explicitArray: false, trim: true }) as XML<Arena>).root

    const name = i18n.getTranslation(meta.name.replace('#arenas:', ''))
    const season = meta.vehicleCamouflageKind
    const bbox = bboxParser(meta.boundingBox)

    const gameplayMeta = Object.entries(meta.gameplayTypes).map(([gameplay, data]) => {
      const teamBasePositions = data.teamBasePositions
      const teamSpawnPoints = data.teamSpawnPoints
      const controlPoint = data.controlPoint
      const poiPoints = data.pointsOfInterestUDO?.point?.map(p => ({ position: vec2(p.position), type: p.type }))
      const bbox = data.boundingBox
      const winnerIfTimeout = data.winnerIfTimeout
      const winnerIfExtermination = data.winnerIfExtermination

      const base = teamBasePositions ? Object.entries(teamBasePositions)
        .filter(([team, positions]) => positions != '')
        .map(([team, positions]) => {
          const teamNumber = Number(team.match(/(\d+)/)![0])
          const pos = Object.entries(positions)
            .toSorted((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))
            .map(t => t[1])
            .map(p => vec2(p))
          return { team: teamNumber, positions: pos }
        }) : undefined

      const spawn = teamSpawnPoints ? Object.entries(teamSpawnPoints)
        .filter(([team, positions]) => positions != '')
        .map(([team, positions]) => {
          const teamNumber = Number(team.match(/(\d+)/)![0])

          if (typeof positions === 'string') {
            return { team: teamNumber, pos: [vec2(positions)] }
          }

          if (typeof positions.position === 'string') {
            return { team: teamNumber, pos: [vec2(positions.position)] }
          }

          if (Array.isArray(positions.position)) {
            return { team: teamNumber, pos: positions.position.map(p => vec2(p)) }
          }
        }) : undefined

      let control = undefined
      if (controlPoint) {
        if (typeof controlPoint === 'string') {
          control = [vec2(controlPoint)]
        } else {
          control = controlPoint.map(p => vec2(p))
        }
      }

      return {
        gameplay,
        bbox: bbox ? bboxParser(bbox) : undefined,
        minimap: data.minimap,
        base,
        spawn,
        control,
        poi: poiPoints,
        winnerIfTimeout: winnerIfTimeout ? parseInt(winnerIfTimeout) : undefined,
        winnerIfExtermination: winnerIfExtermination ? parseInt(winnerIfExtermination) : undefined,
      }
    })

    result.push(...gameplayMeta.flatMap(g => ({
      id: arena.id,
      tag: arena.name,
      name,
      season,
      ...g,
      bbox: g.bbox ?? bbox,
      minimap: g.minimap ?? meta.minimap
    })) as any)
  }

  return result
}


export async function load(root: string, region: string, version: GameVersion) {
  const res = await process(root, region)

  const v2t = (t: { x: number, y: number }) => ([t.x, t.y])

  const insertValues = res.map(t => ({
    region,
    gameVersionFull: version.full,
    gameVersion: version.version,
    gameVersionHash: version.hash,
    tag: t.tag,
    gameplay: t.gameplay,
    datetime: Math.round(new Date().getTime() / 1000),
    gameVersionComp: version.comparable,
    id: t.id,
    name: t.name,
    season: t.season,
    minimap: t.minimap,
    winnerIfTimeout: t.winnerIfTimeout,
    winnerIfExtermination: t.winnerIfExtermination,
    'bbox.bottomLeft': v2t(t.bbox.bottomLeft),
    'bbox.upperRight': v2t(t.bbox.upperRight),
    'base.team': t.base?.map(t => t.team) ?? [],
    'base.positions': t.base?.map(t => t.positions.map(v2t)) ?? [],
    'spawn.team': t.spawn?.map(t => t.team) ?? [],
    'spawn.positions': t.spawn?.map(t => t.pos.map(v2t)) ?? [],
    control: t.control?.map(v2t) ?? [],
    'poi.position': t.poi?.map(t => v2t(t.position)) ?? [],
    'poi.type': t.poi?.map(t => t.type) ?? [],
  }))


  console.log('Inserting arenas...');
  await clickhouse.insert({
    table: 'WOT.Arenas',
    values: insertValues,
    format: 'JSONEachRow'
  })
  console.log(`Arena inserted for: ${region}`);
}