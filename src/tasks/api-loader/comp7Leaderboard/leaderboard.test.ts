import { afterAll, expect, spyOn, test } from 'bun:test'
import { clickhouse } from '@/db'
import { load } from './leaderboard'

const insert = spyOn(clickhouse, 'insert').mockResolvedValue({ query_id: 'test', executed: true, response_headers: {} })
const command = spyOn(clickhouse, 'command').mockResolvedValue({ query_id: 'test', response_headers: {} })
afterAll(() => {
  insert.mockRestore()
  command.mockRestore()
})

for (const region of ['RU', 'EU']) {
  test(`preserves API divisions and rollback flags for ${region}`, async () => {
    insert.mockClear()
    const divisions = ['11', '12', '13', '21', '22', '23']
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const page = Number(new URL(request.url).searchParams.get('page_number'))
        return Response.json({
          meta: {
            pages_amount: 2,
            last_leaderboard_recalculation_ts: 1788792300,
            next_leaderboard_recalculation_ts: null,
            elite_rank_position_threshold: region === 'RU' ? null : 1
          },
          data: divisions.slice((page - 1) * 3, page * 3).map((p1, i) => ({
            rank: (page - 1) * 3 + i + 1,
            spa_id: (page - 1) * 3 + i + 1,
            p1, p2: '3450', p3: '100', name: 'test', clan_tag: null, clan_color: null
          }))
        })
      }
    })
    try {
      await load(region, server.url.toString())
      expect(insert).toHaveBeenCalledTimes(1)
      const values = insert.mock.calls[0][0].values
      expect(values).toEqual(expect.arrayContaining([
        expect.objectContaining({ division: 11, oldElite: true }),
        expect.objectContaining({ division: 12, oldElite: true }),
        expect.objectContaining({ division: 13, oldElite: true }),
        expect.objectContaining({ division: 21, oldElite: false }),
        expect.objectContaining({ division: 22, oldElite: false }),
        expect.objectContaining({ division: 23, oldElite: false })
      ]))
      expect(values).toHaveLength(6)
    } finally {
      await server.stop(true)
    }
  })
}
