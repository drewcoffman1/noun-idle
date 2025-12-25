# Deploying Noun Coffee Tycoon

## Quick Deploy to Vercel

1. **Connect to Vercel:**
   ```bash
   npm i -g vercel
   vercel
   ```

2. **Set Environment Variables** in Vercel Dashboard:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `NOUN_TOKEN_ADDRESS` (optional)
   - `NEXT_PUBLIC_BASE_RPC` (optional)

3. **Deploy:**
   ```bash
   vercel --prod
   ```

4. **Update Farcaster Manifest:**
   Edit `public/.well-known/farcaster.json` with your Vercel URL

5. **Test in Warpcast:**
   - Enable developer mode
   - Share your mini app URL
   - Test with real Farcaster users!

## Alternative: Deploy via GitHub

1. Go to https://vercel.com/new
2. Import your repository: `drewcoffman1/noun-idle`
3. Select branch: `claude/farcaster-mini-app-game-U8hit`
4. Add environment variables
5. Deploy!

## Post-Deployment Checklist

- [ ] Redis connected and working
- [ ] Game state persists across sessions
- [ ] Idle earnings calculated correctly
- [ ] Daily quests reset properly
- [ ] Leaderboards populated
- [ ] Farcaster manifest loads at `/.well-known/farcaster.json`
- [ ] Can open in Warpcast

## Updating the Manifest

After deployment, update `public/.well-known/farcaster.json`:
- Replace all URLs with your Vercel URL
- Update `accountAssociation` with your FID
- Get signature from Farcaster
