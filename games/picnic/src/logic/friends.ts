/** Who comes to the picnic, as the sheet paints them. A table seats four at most. */
export type FriendId = 'teddy' | 'bunny' | 'fox' | 'raccoon';

export const FRIENDS: readonly FriendId[] = ['teddy', 'bunny', 'fox', 'raccoon'];

/** Each friend's four faces. */
export type Mood = 'happy' | 'eating' | 'puzzled' | 'grumpy';

export const FRIEND_NAMES: Readonly<Record<FriendId, string>> = {
  teddy: 'Teddy',
  bunny: 'Bunny',
  fox: 'Fox',
  raccoon: 'Raccoon',
};

/** Things that come in the basket, counted out one by one. */
export type TreatId = 'cookie' | 'strawberry' | 'grapes' | 'sandwich';

/** One and many, for the sentences on the card. */
export const TREAT_NAMES: Readonly<Record<TreatId, readonly [string, string]>> = {
  cookie: ['cookie', 'cookies'],
  strawberry: ['strawberry', 'strawberries'],
  grapes: ['bunch of grapes', 'bunches of grapes'],
  sandwich: ['sandwich', 'sandwiches'],
};

/** Things that come whole and are cut. */
export type FoodId = 'pizza' | 'cake';

export const treatName = (treat: TreatId, count: number): string => TREAT_NAMES[treat][count === 1 ? 0 : 1];
