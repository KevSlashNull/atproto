import AtpAgent from '@atproto/api'
import { TestEnvInfo, runTestEnv } from '@atproto/dev-env'
import {
  adminAuth,
  appViewHeaders,
  forSnapshot,
  paginateAll,
  processAll,
  stripViewer,
} from '../_util'
import { SeedClient } from '../seeds/client'
import followsSeed from '../seeds/follows'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'

describe('pds follow views', () => {
  let agent: AtpAgent
  let testEnv: TestEnvInfo
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'bsky_views_follows',
    })
    agent = new AtpAgent({ service: testEnv.bsky.url })
    const pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await followsSeed(sc)
    await processAll(testEnv)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await testEnv.close()
  })

  // TODO(bsky) blocks followers by actor takedown via labels
  // TODO(bsky) blocks follows by actor takedown via labels

  it('fetches followers', async () => {
    const aliceFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()

    const bobFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.bob },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()

    const carolFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.carol },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()

    const danFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.dan },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()

    const eveFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.eve },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(forSnapshot(eveFollowers.data)).toMatchSnapshot()
  })

  it('fetches followers by handle', async () => {
    const byDid = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      { headers: await appViewHeaders(alice, testEnv) },
    )
    const byHandle = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.accounts[alice].handle },
      { headers: await appViewHeaders(alice, testEnv) },
    )
    expect(byHandle.data).toEqual(byDid.data)
  })

  it('paginates followers', async () => {
    const results = (results) => results.flatMap((res) => res.followers)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.graph.getFollowers(
        {
          actor: sc.dids.alice,
          cursor,
          limit: 2,
        },
        { headers: await appViewHeaders(alice, testEnv) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.followers.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(full.data.followers.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches followers unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      { headers: await appViewHeaders(alice, testEnv) },
    )
    const { data: unauthed } = await agent.api.app.bsky.graph.getFollowers({
      actor: sc.dids.alice,
    })
    expect(unauthed.followers.length).toBeGreaterThan(0)
    expect(unauthed.followers).toEqual(authed.followers.map(stripViewer))
  })

  it('blocks followers by actor takedown', async () => {
    const { data: modAction } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.dan,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    const aliceFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(aliceFollowers.data.followers.map((f) => f.did)).not.toContain(
      sc.dids.dan,
    )

    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: modAction.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })

  it('fetches follows', async () => {
    const aliceFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.alice },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()

    const bobFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.bob },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()

    const carolFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.carol },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()

    const danFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.dan },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()

    const eveFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.eve },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(forSnapshot(eveFollowers.data)).toMatchSnapshot()
  })

  it('fetches follows by handle', async () => {
    const byDid = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.alice },
      { headers: await appViewHeaders(alice, testEnv) },
    )
    const byHandle = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.accounts[alice].handle },
      { headers: await appViewHeaders(alice, testEnv) },
    )
    expect(byHandle.data).toEqual(byDid.data)
  })

  it('paginates follows', async () => {
    const results = (results) => results.flatMap((res) => res.follows)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.graph.getFollows(
        {
          actor: sc.dids.alice,
          cursor,
          limit: 2,
        },
        { headers: await appViewHeaders(alice, testEnv) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.follows.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.alice },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(full.data.follows.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches follows unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.alice },
      { headers: await appViewHeaders(alice, testEnv) },
    )
    const { data: unauthed } = await agent.api.app.bsky.graph.getFollows({
      actor: sc.dids.alice,
    })
    expect(unauthed.follows.length).toBeGreaterThan(0)
    expect(unauthed.follows).toEqual(authed.follows.map(stripViewer))
  })

  it('blocks follows by actor takedown', async () => {
    const { data: modAction } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.dan,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    const aliceFollows = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.alice },
      { headers: await appViewHeaders(alice, testEnv) },
    )

    expect(aliceFollows.data.follows.map((f) => f.did)).not.toContain(
      sc.dids.dan,
    )

    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: modAction.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })
})
