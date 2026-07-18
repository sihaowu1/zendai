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

export const marketplaceRouter = Router();

// Publish a new item (authenticated)
marketplaceRouter.post('/marketplace/publish', requireAuth, requireMongo, (async (req, res) => {
  const { title, description, code, blenderCode } = req.body as PublishRequest;
  if (!title || !code) {
    res.status(400).json({ error: 'title and code are required.' });
    return;
  }

  const auth = (req as any).auth?.payload ?? {};
  const creator = {
    sub: auth.sub as string ?? 'anonymous',
    name: (auth.name ?? auth.nickname ?? auth.sub ?? 'Anonymous') as string,
    picture: auth.picture as string | undefined,
  };

  const item = await MarketplaceItem.create({
    title: title.slice(0, 120),
    description: (description ?? '').slice(0, 1000),
    code,
    blenderCode: blenderCode ?? '',
    creator,
  });

  res.status(201).json({ id: item._id });
}) as RequestHandler);

// List published items (public, paginated)
marketplaceRouter.get('/marketplace', requireMongo, (async (_req, res) => {
  const page = Math.max(1, Number(_req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(_req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const items = await MarketplaceItem.find()
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-code -blenderCode')
    .lean();

  const total = await MarketplaceItem.countDocuments();

  const summaries: MarketplaceItemSummary[] = items.map((item) => ({
    id: String(item._id),
    title: item.title,
    description: item.description,
    creator: { name: item.creator.name, picture: item.creator.picture },
    publishedAt: item.publishedAt.toISOString(),
  }));

  res.json({ items: summaries, total, page, pages: Math.ceil(total / limit) });
}) as RequestHandler);

// Get a single item with full code (public)
marketplaceRouter.get('/marketplace/:id', requireMongo, (async (req, res) => {
  const item = await MarketplaceItem.findById(req.params.id).lean();
  if (!item) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }

  const detail: MarketplaceItemDetail = {
    id: String(item._id),
    title: item.title,
    description: item.description,
    code: item.code,
    blenderCode: item.blenderCode,
    creator: { name: item.creator.name, picture: item.creator.picture },
    publishedAt: item.publishedAt.toISOString(),
  };

  res.json(detail);
}) as RequestHandler);
