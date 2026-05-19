// seed.js — built-in libraries. Pure data, no DOM, no network.
// Copied into IndexedDB once by storage.seedIfEmpty(); thereafter the user
// owns them (rate, edit, delete). Bracketed [parts] are fill-in placeholders.

// Local id generator — kept independent of storage.js to avoid a circular
// import (storage.js imports the SEED_* arrays from this file).
let _n = 0;
const uid = () => 's' + (Date.now().toString(36)) + (_n++).toString(36);

const H = (text, category, niche = 'general', tone = '') =>
  ({ id: uid(), text, category, niche, tone, source: '' });

// ---- Hook library — proven opening frameworks ---------------------------

export const SEED_HOOKS = [
  // curiosity gap
  H('Nobody talks about what happens [time period] after you [action].', 'curiosity-gap', 'general', 'Curious'),
  H('There is a reason [authority/group] never [common action] — and it is not what you think.', 'curiosity-gap'),
  H('I found the [thing] that [surprising outcome]. It costs almost nothing.', 'curiosity-gap'),
  H('This one change to my [routine] did more than [expensive alternative] ever did.', 'curiosity-gap', 'fitness'),
  H('The [number]-second test that tells you if your [thing] is actually working.', 'curiosity-gap'),
  H('What I am about to show you will make you question every [thing] you own.', 'curiosity-gap'),
  H('There is a hidden setting in [app/tool] that [benefit]. Almost no one uses it.', 'curiosity-gap', 'tech'),
  H('I asked [number] [experts] the same question. Their answers shocked me.', 'curiosity-gap'),
  H('The real reason [common problem] keeps happening to you.', 'curiosity-gap'),
  H('Here is what [profession] do that they will never tell you for free.', 'curiosity-gap'),
  H('I tracked [metric] for [time period]. The pattern was not what I expected.', 'curiosity-gap', 'finance'),
  H('Watch what happens when I [action] — wait for the end.', 'curiosity-gap'),
  H('The [thing] in your [place] is doing the opposite of what you think.', 'curiosity-gap'),
  H('Three things about [topic] that took me [number] years to learn.', 'curiosity-gap'),
  H('You are [time/effort] away from [result] and you do not even know it.', 'curiosity-gap'),
  H('The question [audience] should be asking about [topic] — but never does.', 'curiosity-gap'),
  H('I reverse-engineered [successful thing]. Here is the part everyone misses.', 'curiosity-gap'),

  // pattern interrupt
  H('Stop scrolling. You are doing [common task] wrong.', 'pattern-interrupt', 'general', 'Disruptive'),
  H('Put the [object] down. We need to talk about [topic].', 'pattern-interrupt'),
  H('Do not buy [product category] until you watch this.', 'pattern-interrupt', 'general', 'Urgent'),
  H('Delete this app right now if you [condition].', 'pattern-interrupt', 'tech'),
  H('Wait. Before you [common action], do this first.', 'pattern-interrupt'),
  H('Unpopular opinion: [common advice] is making it worse.', 'pattern-interrupt', 'general', 'Disruptive'),
  H('I need you to forget everything you know about [topic].', 'pattern-interrupt'),
  H('That [thing] you just did? Here is why it backfires.', 'pattern-interrupt'),
  H('Hold on — you have been told [myth] your whole life.', 'pattern-interrupt'),
  H('If you only watch one video about [topic], make it this one.', 'pattern-interrupt', 'general', 'Authoritative'),
  H('Throw this away. Seriously. Right now.', 'pattern-interrupt'),
  H('Your [thing] is lying to you. Let me prove it.', 'pattern-interrupt'),
  H('Read this before your next [event/purchase].', 'pattern-interrupt'),
  H('Everyone is doing [trend]. Here is why I stopped.', 'pattern-interrupt'),

  // bold claim
  H('I [achieved result] in [timeframe] without [common requirement].', 'bold-claim', 'general', 'Authoritative'),
  H('This is the only [thing] you will ever need for [goal].', 'bold-claim'),
  H('I can teach anyone to [skill] in under [timeframe].', 'bold-claim'),
  H('[Common product] is a waste of money. Here is what works instead.', 'bold-claim', 'general', 'Disruptive'),
  H('You will never [common problem] again after this.', 'bold-claim'),
  H('This [cheap thing] outperforms the [expensive thing] every time.', 'bold-claim'),
  H('I have [done thing] [large number] times. Here is the only rule that matters.', 'bold-claim', 'general', 'Authoritative'),
  H('Ninety percent of [audience] get [topic] completely wrong.', 'bold-claim'),
  H('The fastest way to [result] has nothing to do with [assumed factor].', 'bold-claim'),
  H('I will save you [money/time] in the next [duration].', 'bold-claim', 'finance'),
  H('Your [goal] is failing for exactly one reason.', 'bold-claim'),
  H('Master this one thing and everything else about [topic] gets easy.', 'bold-claim'),
  H('I would not [do common thing] even if you paid me. Here is why.', 'bold-claim', 'general', 'Disruptive'),
  H('There is a right order to do [process] and almost no one follows it.', 'bold-claim'),

  // relatability
  H('POV: you [relatable situation] and [relatable consequence].', 'relatability', 'general', 'Empathetic'),
  H('Tell me you are a [identity] without telling me you are a [identity].', 'relatability'),
  H('Me explaining [thing] to my [person] for the hundredth time.', 'relatability', 'general', 'Playful'),
  H('If you also [relatable habit], this one is for you.', 'relatability'),
  H('Nobody warned me that [life stage] would mean [unexpected reality].', 'relatability', 'parenting', 'Empathetic'),
  H('That moment when you [relatable small win].', 'relatability', 'general', 'Playful'),
  H('I thought it was just me until [number] people told me the same thing.', 'relatability'),
  H('Raise your hand if you have ever [embarrassing common thing].', 'relatability'),
  H('The [audience] starter pack nobody asked for.', 'relatability', 'general', 'Playful'),
  H('Things [audience] say that we all secretly mean.', 'relatability'),
  H('Day [number] of [relatable ongoing struggle].', 'relatability', 'general', 'Empathetic'),
  H('When you finally [milestone] but [bittersweet truth].', 'relatability'),
  H('The hardest part of [activity] no one prepares you for.', 'relatability', 'general', 'Empathetic'),

  // controversy
  H('[Beloved thing] is overrated. Come fight me in the comments.', 'controversy', 'general', 'Disruptive'),
  H('I am about to lose followers for saying this about [topic].', 'controversy'),
  H('The [industry] does not want you to know this.', 'controversy'),
  H('Stop giving [group] your money for [thing]. Here is why.', 'controversy', 'finance'),
  H('Everyone praises [popular thing]. I think it is the problem.', 'controversy'),
  H('Hot take: [common belief] is the reason you are stuck.', 'controversy'),
  H('We need to stop pretending [common practice] works.', 'controversy'),
  H('[Trend] is not [positive label]. It is [negative reframe].', 'controversy'),
  H('The advice everyone gives about [topic] is quietly harmful.', 'controversy'),
  H('I will say what no one in [niche] will: [contrarian claim].', 'controversy', 'general', 'Disruptive'),
  H('Why I quit [popular thing] at the peak.', 'controversy'),

  // transformation
  H('[Before state] to [after state] in [timeframe]. Here is exactly how.', 'transformation', 'general', 'Authoritative'),
  H('A year ago I could not [skill]. Watch this.', 'transformation'),
  H('I changed one habit and [area of life] completely flipped.', 'transformation', 'fitness'),
  H('From [low number] to [high number] — and the only thing that moved the needle.', 'transformation', 'finance'),
  H('This is what [timeframe] of [consistent action] actually looks like.', 'transformation'),
  H('The before will make the after hard to believe.', 'transformation', 'beauty'),
  H('I rebuilt my [thing] from scratch. Here is the blueprint.', 'transformation'),
  H('Same person, [timeframe] apart. The difference was not [assumed factor].', 'transformation'),
  H('I tried [method] for [duration] so you do not have to. Results inside.', 'transformation'),
  H('How I went from [pain point] to [desired state] without [common sacrifice].', 'transformation'),
  H('The glow-up nobody saw coming — and the boring habit behind it.', 'transformation', 'beauty'),

  // fomo
  H('This [opportunity] closes [timeframe]. Do not say I did not warn you.', 'fomo', 'general', 'Urgent'),
  H('Everyone you follow is already doing [trend]. You are late.', 'fomo'),
  H('Save this before [platform/algorithm] buries it.', 'fomo', 'general', 'Urgent'),
  H('You have about [timeframe] before [thing] gets [worse/expensive].', 'fomo'),
  H('The [number] people who do this will be ahead of everyone in [timeframe].', 'fomo'),
  H('If you are not doing this in [year/season], you are leaving [benefit] on the table.', 'fomo'),
  H('This window does not stay open. Here is what to do today.', 'fomo', 'general', 'Urgent'),
  H('By the time this is mainstream it is already too late to win.', 'fomo'),
  H('Screenshot this. You will want it in [timeframe].', 'fomo'),
  H('The early people in [trend] are about to look very smart.', 'fomo', 'finance'),
];

// ---- Framework gallery — pre-built block sequences -----------------------
// Each block: { type, text } where text is placeholder script copy.

const F = (name, category, blocks) => ({ id: uid(), name, category, blocks });

export const SEED_FRAMEWORKS = [
  F('Product demo', 'product-demo', [
    { type: 'hook', text: '"You have been using [product category] wrong."' },
    { type: 'problem', text: 'Most people [common mistake] and it costs them [consequence].' },
    { type: 'demo', text: 'Here is how [product] actually works — watch this.' },
    { type: 'proof', text: 'I have used it for [time period] and [specific result].' },
    { type: 'cta', text: 'Link in bio. Tell me what you would use it for.' },
  ]),
  F('Before / after', 'before-after', [
    { type: 'hook', text: 'The before is going to be hard to look at.' },
    { type: 'problem', text: 'For [time period] I dealt with [pain point].' },
    { type: 'bridge', text: 'Then I changed exactly one thing.' },
    { type: 'demo', text: 'Here is the after — and the boring habit behind it.' },
    { type: 'cta', text: 'Comment [word] and I will send you the full breakdown.' },
  ]),
  F('Day in my life', 'day-in-life', [
    { type: 'hook', text: 'Day in the life of a [identity] who [unusual detail].' },
    { type: 'transition', text: 'It starts earlier than you think.' },
    { type: 'demo', text: 'Here is the part nobody posts about.' },
    { type: 'proof', text: 'This routine got me [result].' },
    { type: 'cta', text: 'Follow for the rest of the week.' },
  ]),
  F('3 things I wish I knew', 'listicle', [
    { type: 'hook', text: 'Three things I wish I knew before [milestone].' },
    { type: 'demo', text: 'One: [point]. This alone would have saved me [cost].' },
    { type: 'demo', text: 'Two: [point]. Nobody tells you this part.' },
    { type: 'demo', text: 'Three: [point]. This is the one that changed everything.' },
    { type: 'cta', text: 'Save this. Future you will thank you.' },
  ]),
  F('Tutorial', 'tutorial', [
    { type: 'hook', text: 'The fastest way to [outcome] in [number] steps.' },
    { type: 'demo', text: 'Step one: [action]. Do not skip this.' },
    { type: 'demo', text: 'Step two: [action]. This is where most people quit.' },
    { type: 'demo', text: 'Step three: [action]. Now watch what happens.' },
    { type: 'cta', text: 'Try it and tag me — I want to see your version.' },
  ]),
  F('Story arc', 'story-arc', [
    { type: 'hook', text: '[Timeframe] ago, [dramatic situation].' },
    { type: 'problem', text: 'Everything was going wrong because [reason].' },
    { type: 'bridge', text: 'Then [turning point].' },
    { type: 'demo', text: 'Here is what I did differently.' },
    { type: 'proof', text: 'Today, [resolution].' },
    { type: 'cta', text: 'The full story is on my page. Start from the first video.' },
  ]),
  F('Myth-bust', 'myth-bust', [
    { type: 'hook', text: 'You have been told [myth] your whole life.' },
    { type: 'problem', text: 'Here is why that advice keeps you stuck.' },
    { type: 'bridge', text: 'The truth is the opposite.' },
    { type: 'proof', text: 'Here is the evidence.' },
    { type: 'cta', text: 'Share this with someone who still believes it.' },
  ]),
  F('Brand awareness', 'brand-awareness', [
    { type: 'hook', text: 'We built [product] because [problem] should not exist.' },
    { type: 'problem', text: 'Everyone in [space] does it [old way].' },
    { type: 'demo', text: 'Here is what we do instead.' },
    { type: 'proof', text: '[Number] people have already [outcome].' },
    { type: 'cta', text: 'See if it is for you — link in bio.' },
  ]),
  F('Product review', 'review', [
    { type: 'hook', text: 'I spent [money] on [product] so you do not have to.' },
    { type: 'demo', text: 'Here is what it actually does.' },
    { type: 'objection', text: 'Now the part the ads do not show you.' },
    { type: 'proof', text: 'After [time period], here is my honest verdict.' },
    { type: 'cta', text: 'Want the full pros and cons? Comment [word].' },
  ]),
  F('Transformation', 'transformation', [
    { type: 'hook', text: 'From [before] to [after] — the real timeline.' },
    { type: 'problem', text: 'At the start I [struggle].' },
    { type: 'demo', text: 'The system I followed, step by step.' },
    { type: 'objection', text: 'And what I would do differently.' },
    { type: 'proof', text: 'The numbers, no filter.' },
    { type: 'cta', text: 'Full plan on my page. Start today, not Monday.' },
  ]),
  F('Hot take', 'hot-take', [
    { type: 'hook', text: 'I am going to lose followers for this.' },
    { type: 'bridge', text: 'Everyone praises [popular thing]. I think it is the problem.' },
    { type: 'proof', text: 'Here is why, with receipts.' },
    { type: 'objection', text: 'Yes, I know the counter-argument. It does not hold.' },
    { type: 'cta', text: 'Tell me I am wrong in the comments. I will read every one.' },
  ]),
  F('Quick tip', 'quick-tip', [
    { type: 'hook', text: 'A [number]-second trick that [benefit].' },
    { type: 'demo', text: 'Do this.' },
    { type: 'proof', text: 'That is it. Here is the difference it makes.' },
    { type: 'cta', text: 'Follow for one of these every day.' },
  ]),
  F('Comparison', 'comparison', [
    { type: 'hook', text: '[Option A] versus [Option B] — settled in [timeframe].' },
    { type: 'demo', text: 'Option A: [strengths and weaknesses].' },
    { type: 'demo', text: 'Option B: [strengths and weaknesses].' },
    { type: 'proof', text: 'The one I actually use and why.' },
    { type: 'cta', text: 'Which side are you on? Comment below.' },
  ]),
  F('Mistake breakdown', 'mistake', [
    { type: 'hook', text: 'The [number] mistakes keeping you from [goal].' },
    { type: 'problem', text: 'Mistake one: [mistake]. Most people never notice it.' },
    { type: 'problem', text: 'Mistake two: [mistake]. This one is expensive.' },
    { type: 'bridge', text: 'Fix both and [outcome].' },
    { type: 'cta', text: 'Save this before you make them again.' },
  ]),
  F('Behind the scenes', 'bts', [
    { type: 'hook', text: 'What [process] actually looks like behind the scenes.' },
    { type: 'transition', text: 'It is messier than the highlight reel.' },
    { type: 'demo', text: 'Here is the part that takes the longest.' },
    { type: 'proof', text: 'And here is the result it leads to.' },
    { type: 'cta', text: 'Want a full BTS series? Let me know.' },
  ]),
  F('Question to answer', 'q-and-a', [
    { type: 'hook', text: 'The question I get asked the most: [question].' },
    { type: 'bridge', text: 'Short answer: [answer].' },
    { type: 'demo', text: 'Long answer, because it matters: [explanation].' },
    { type: 'cta', text: 'Drop your questions and I will make the next one.' },
  ]),
  F('Listicle countdown', 'listicle', [
    { type: 'hook', text: '[Number] [things] ranked from worst to best.' },
    { type: 'demo', text: 'Number [n]: [item]. [One-line verdict].' },
    { type: 'demo', text: 'Number [n]: [item]. [One-line verdict].' },
    { type: 'demo', text: 'Number one: [item]. Not even close.' },
    { type: 'cta', text: 'Disagree with my number one? I am listening.' },
  ]),
  F('Problem - agitate - solve', 'pas', [
    { type: 'hook', text: 'If [problem], this is for you.' },
    { type: 'problem', text: 'It gets worse: [agitation].' },
    { type: 'bridge', text: 'Here is the way out.' },
    { type: 'demo', text: 'Step by step.' },
    { type: 'cta', text: 'Comment [word] for the full guide.' },
  ]),
  F('Trend reaction', 'trend', [
    { type: 'hook', text: 'Everyone is doing [trend]. I tried it so you can decide.' },
    { type: 'demo', text: 'Here is how it actually went.' },
    { type: 'objection', text: 'The part the trend videos skip.' },
    { type: 'proof', text: 'Verdict: [worth it / skip it] because [reason].' },
    { type: 'cta', text: 'Should I try the next one? Vote in the comments.' },
  ]),
  F('Hard truth', 'hard-truth', [
    { type: 'hook', text: 'Nobody is going to tell you this, so I will.' },
    { type: 'bridge', text: '[Hard truth].' },
    { type: 'proof', text: 'Here is why it is true.' },
    { type: 'demo', text: 'And here is what to do about it starting today.' },
    { type: 'cta', text: 'Send this to someone who needs to hear it.' },
  ]),
];

// ---- CTA sub-library — proven closers -----------------------------------

const C = (text, format, platform = 'any') => ({ id: uid(), text, format, platform, source: '' });

export const SEED_CTAS = [
  C('Follow for part two — it is the one you actually need.', 'follow', 'any'),
  C('Follow if you want the rest of this series.', 'follow', 'any'),
  C('Link in bio for the full breakdown.', 'link-in-bio', 'any'),
  C('Everything I mentioned is linked in my bio.', 'link-in-bio', 'any'),
  C('Comment "[word]" and I will send it straight to you.', 'comment-trigger', 'tiktok'),
  C('Comment "yes" if this happened to you too.', 'comment-trigger', 'tiktok'),
  C('Tell me in the comments — am I wrong?', 'comment-trigger', 'tiktok'),
  C('Which one are you? Comment 1 or 2.', 'comment-trigger', 'tiktok'),
  C('Save this so you have it when you need it.', 'save-prompt', 'reels'),
  C('Save this before you forget it exists.', 'save-prompt', 'reels'),
  C('Share this with the one person who needs it.', 'save-prompt', 'reels'),
  C('Duet this with your version — I want to see it.', 'duet', 'tiktok'),
  C('Stitch this and tell me where I am wrong.', 'duet', 'tiktok'),
  C('It is [product]. Linked in bio if you want to try it.', 'product', 'any'),
  C('Use code [code] if you decide it is for you. No pressure.', 'product', 'any'),
  C('Subscribe so the algorithm stops hiding these from you.', 'follow', 'shorts'),
];
