import AtpAgent from '@atproto/api'
import { runTestEnv, CloseFn, processAll } from '@atproto/dev-env'
import { FeedViewPost } from '../../src/lexicon/types/app/bsky/feed/defs'
import { forSnapshot, getOriginator, paginateAll } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { FeedAlgorithm } from '../../src/app-view/api/app/bsky/util/feed'

describe('timeline proxy views', () => {
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    const testEnv = await runTestEnv({
      dbPostgresSchema: 'proxy_timeline',
    })
    close = testEnv.close
    agent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    await processAll(testEnv)
    await testEnv.pds.ctx.labeler.processAll()
  })

  afterAll(async () => {
    await close()
  })

  it("fetches authenticated user's home feed w/ reverse-chronological algorithm", async () => {
    const expectOriginatorFollowedBy = (did) => (item: FeedViewPost) => {
      const originator = getOriginator(item)
      // The user expects to see posts & reposts from themselves and follows
      if (did !== originator) {
        expect(sc.follows[did]).toHaveProperty(originator)
      }
    }

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()
    aliceTL.data.feed.forEach(expectOriginatorFollowedBy(alice))

    const bobTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(bob),
      },
    )

    expect(forSnapshot(bobTL.data.feed)).toMatchSnapshot()
    bobTL.data.feed.forEach(expectOriginatorFollowedBy(bob))

    const carolTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolTL.data.feed)).toMatchSnapshot()
    carolTL.data.feed.forEach(expectOriginatorFollowedBy(carol))

    const danTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(dan),
      },
    )

    expect(forSnapshot(danTL.data.feed)).toMatchSnapshot()
    danTL.data.feed.forEach(expectOriginatorFollowedBy(dan))
  })

  it("fetches authenticated user's home feed w/ default algorithm", async () => {
    const defaultTL = await agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )
    const reverseChronologicalTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: sc.getHeaders(alice),
      },
    )
    expect(defaultTL.data.feed).toEqual(reverseChronologicalTL.data.feed)
  })

  it('omits posts and reposts of muted authors.', async () => {
    await agent.api.app.bsky.graph.muteActor(
      { actor: bob },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await agent.api.app.bsky.graph.muteActor(
      { actor: carol },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()

    // Cleanup
    await agent.api.app.bsky.graph.unmuteActor(
      { actor: bob },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
    await agent.api.app.bsky.graph.unmuteActor(
      { actor: carol },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
  })

  it('paginates reverse-chronological feed', async () => {
    const results = (results) => results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getTimeline(
        {
          algorithm: FeedAlgorithm.ReverseChronological,
          cursor,
          limit: 4,
        },
        { headers: sc.getHeaders(carol) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(4),
    )

    const full = await agent.api.app.bsky.feed.getTimeline(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
      },
      { headers: sc.getHeaders(carol) },
    )

    expect(full.data.feed.length).toEqual(7)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
