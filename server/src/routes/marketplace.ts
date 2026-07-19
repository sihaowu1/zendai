import { Router, type RequestHandler } from 'express';
import type { MarketplaceItemDetail, MarketplaceItemSummary, PublishRequest } from '@motionforge/shared';
import { requireAuth } from '../auth/middleware';
import { isMongoConnected } from '../db/connection';
import { MarketplaceItem } from '../db/models/MarketplaceItem';

/** Returns 503 when MongoDB is not available. */
const requireMongo: RequestHandler = (_req, res, next) => {
  if (!isMongoConnected()) {
    res.status(503).json({ error: 'Marketplace unavailable (MongoDB not connected).' });
    return;
  }
  next();
};

function toSummary(item: {
  _id: unknown;
  title: string;
  description: string;
  code: string;
  animationCode?: string;
  animationName?: string;
  creator: { name: string; picture?: string; sub: string };
  publishedAt: Date;
}): MarketplaceItemSummary {
  return {
    id: String(item._id),
    title: item.title,
    description: item.description,
    code: item.code,
    ...(item.animationCode
      ? {
          animationCode: item.animationCode,
          animationName: item.animationName || undefined,
        }
      : {}),
    creator: { name: item.creator.name, picture: item.creator.picture },
    creatorSub: item.creator.sub,
    publishedAt: item.publishedAt.toISOString(),
  };
}

export const marketplaceRouter = Router();

// Publish a new item (authenticated)
marketplaceRouter.post('/marketplace/publish', requireAuth, requireMongo, (async (req, res) => {
  const { title, description, code, animationCode, animationName } = req.body as PublishRequest;
  if (!title || !code) {
    res.status(400).json({ error: 'title and code are required.' });
    return;
  }

  const auth = (req as any).auth?.payload ?? {};
  const rawSub = (auth.sub ?? 'anonymous') as string;
  const creator = {
    sub: rawSub,
    name: (auth.name ?? auth.nickname ?? rawSub.replace(/^.*\|/, '')) as string,
    picture: auth.picture as string | undefined,
  };

  const trimmedAnim = typeof animationCode === 'string' ? animationCode.trim() : '';
  try {
    const item = await MarketplaceItem.create({
      title: title.slice(0, 120),
      description: (description ?? '').slice(0, 1000),
      code,
      ...(trimmedAnim
        ? {
            animationCode: trimmedAnim,
            animationName: (animationName ?? 'Animation').slice(0, 120),
          }
        : {}),
      creator,
    });
    res.status(201).json({ id: item._id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Publish failed.';
    res.status(400).json({ error: message });
  }
}) as RequestHandler);

// List published items (public, paginated; ?mine=1 filters to own items)
marketplaceRouter.get('/marketplace', requireMongo, (async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (req.query.mine === '1') {
    const auth = (req as any).auth?.payload;
    if (!auth?.sub) {
      res.status(401).json({ error: 'Authentication required for mine filter.' });
      return;
    }
    filter['creator.sub'] = auth.sub;
  }

  const items = await MarketplaceItem.find(filter)
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await MarketplaceItem.countDocuments(filter);

  const summaries: MarketplaceItemSummary[] = items.map(toSummary);

  res.json({ items: summaries, total, page, pages: Math.ceil(total / limit) });
}) as RequestHandler);

// Get a single item with full code (public)
marketplaceRouter.get('/marketplace/:id', requireMongo, (async (req, res) => {
  const item = await MarketplaceItem.findById(req.params.id).lean();
  if (!item) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }

  const detail: MarketplaceItemDetail = toSummary(item);
  res.json(detail);
}) as RequestHandler);

// Update an item (authenticated, owner only)
marketplaceRouter.patch('/marketplace/:id', requireAuth, requireMongo, (async (req, res) => {
  const auth = (req as any).auth?.payload ?? {};
  const item = await MarketplaceItem.findById(req.params.id);
  if (!item) { res.status(404).json({ error: 'Item not found.' }); return; }
  if (item.creator.sub !== auth.sub) { res.status(403).json({ error: 'Not the owner.' }); return; }

  const { title, description } = req.body as { title?: string; description?: string };
  if (title !== undefined) item.title = title.slice(0, 120);
  if (description !== undefined) item.description = description.slice(0, 1000);
  await item.save();

  res.json(toSummary(item));
}) as RequestHandler);

// Delete an item (authenticated, owner only)
marketplaceRouter.delete('/marketplace/:id', requireAuth, requireMongo, (async (req, res) => {
  const auth = (req as any).auth?.payload ?? {};
  const item = await MarketplaceItem.findById(req.params.id);
  if (!item) { res.status(404).json({ error: 'Item not found.' }); return; }
  if (item.creator.sub !== auth.sub) { res.status(403).json({ error: 'Not the owner.' }); return; }

  await item.deleteOne();
  res.status(204).end();
}) as RequestHandler);
