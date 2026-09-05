# Ambient interaction visual review

Verdict: **PASS for the reviewed static visual scope; no blocking visual finding.**

Reviewed 2026-09-05. Independent inspection of the 33 requested native 624×376 PNGs plus current renderer, character, ambient-object, pose, room, and ambient-state sources. This reviewer did not operate the browser or modify source.

## Confirmed results

- **Latest layout request:** In pour/drink snapshots, the tea pot and cup sit on the right top of the existing registration desk, approximately x=250–276, y=292–308. There is no extra tea table or shelf. `canvasLibraryWorld.ts` places `tea-set` there, and `CanvasLibraryRenderer.ts` uses the registration desk support depth for both tabletop props and tool. The cat is centered in open floor space at x≈365–387, y≈150–163, away from the reading bench.
- **Watering:** West/east 450 ms samples show an attached raised arm with the watering can above the target plant; the rear head occludes the intervening arm. The can and water stream do not appear as a detached extra limb or second tool. By 900 ms the tool is gone and the bear returns to rest. Tool coordinates come from the same `getLibraryBearPose().hand` used by the arm.
- **Tea:** Pour 450 ms shows one moved pot, one stationary cup, and a short stream. Drink 450 ms shows one cup held at the face and the pot still on the desk. The static active prop is suppressed, avoiding duplicate pot/cup rendering. Both 900 ms samples restore props to the tabletop. The pot remains above the desk surface and the arm remains connected to the character.
- **Cat and bench:** All three pet samples show the bear next to the cat without overlap that hides the head; cat head/body/leg changes distinguish the successive reactions. Sit 0/450/900 ms moves the bear onto the existing reading bench, ending with separated forward feet at its front edge. No second bench or support is introduced.
- **Book and light:** Book-open changes the existing table book into an open spread with a legible center fold. Lamp-on adds localized stepped pixel light in the reading area, while lamp-off removes it. Existing room geometry and central route remain clear in the snapshots.

## Verification boundary

The three time samples per action verify composition and sampled phases only. Continuous motion, actual controls, hit targets, persistence/reset behavior, audio, reduced motion, and collision must be covered by the parent browser/runtime QA. The lamp-off fixture places the bear away from the lamp, so it proves the off lighting state rather than the switch-touch animation. No additional blocker is asserted from that fixture limitation.

## Source SHA-256

| File | SHA-256 |
|---|---|
| `src/components/student/library/CanvasLibraryRenderer.ts` | `8da9f38c69f6b97897dfcf53be4377fd1f72da318d96211dea70bf5519e06cda` |
| `src/components/student/library/CanvasLibraryCharacter.ts` | `624b5ec23116981d2ed90f1a40f7d4eb34e576d39f555b919efac629f6627bfd` |
| `src/components/student/library/CanvasLibraryAmbient.ts` | `b350cc6bc25e9de3595cf22ebbf5c148bb8451b76c7eec950b6256b32ffe5f16` |
| `src/lib/canvasLibraryPose.ts` | `081beacf8ade3f6d53bc2678eefc2295417cc1ef693286b346be843fe6c42755` |
| `src/lib/canvasLibraryWorld.ts` | `203ac7a4e576c569d84415fbd9c0685ca0588acba2ed60cb4485e8cf3ecceb9b` |
| `src/lib/canvasLibraryAmbient.ts` | `a70b25edb673bab6aac28f585692af6e1063125d51b5d4e9dbdb668217cd8853` |

## Image SHA-256

| File | SHA-256 |
|---|---|
| `water-west-0.png` | `4f45abde90fe7aca96d17e93a3880be4732f8bd1f957f9153531746d6f77d07f` |
| `water-west-450.png` | `c7ae1cfb6724d4585ed5a4c6a3f572b84aa52edf0003c16525b0f71220eb5178` |
| `water-west-900.png` | `0324680a933c9d00546857d49f4ddbec86d46278132c1dad2d12414bda9bb60c` |
| `water-east-0.png` | `f683429fb82fd309beeb902d0a0d5eaf688d3ffa019b15976f33f898ac453d3b` |
| `water-east-450.png` | `2ac09952221f318313a7811870a2257325de9d5820b338bb5c34bdf13bbc59aa` |
| `water-east-900.png` | `f5f95926d4a0a78b1a197a6566f5571a33a678a69e6e6807b05d9146a7a4bb53` |
| `pour-0.png` | `e69d472b998119c1761a2db9ca363b4bb88994300468e5de7777d408d6472c75` |
| `pour-450.png` | `4cb0300ac091ec8c88a33ca4ded3c8eabe31c07a6acd1c97980fae1b108ccb06` |
| `pour-900.png` | `1870a5b04dbb79fca42e4ae958db0b7438d8804b1231a6798bb647fbc525f20e` |
| `drink-0.png` | `dbaa71ac18780681659daa6cc084f603a3f28387595f0f9452ec2604531fa198` |
| `drink-450.png` | `4ddd35c7ea2c6fc7750ece8f5450479dce77197f6cfa1415313fdb09033a7da6` |
| `drink-900.png` | `abc5de6ba0162d7944e9aca440970b182b210b331f7e51093424abc9b88e81ff` |
| `pet-first-0.png` | `1b89fd2894c43bbef08645a254c041f2f25275959ee488d5646a14c26488c68d` |
| `pet-first-450.png` | `c1ab883034740571e0cc0e054a59b066142be56f15857219f44c13a7de445eee` |
| `pet-first-900.png` | `ea7654d754f214e74f8aebca389b0ecd6e9685b42d1261411b57e9713d1a03a0` |
| `pet-second-0.png` | `1b89fd2894c43bbef08645a254c041f2f25275959ee488d5646a14c26488c68d` |
| `pet-second-450.png` | `30114d31f846002c923cb358508727521e4b05e9a1eb73ee61d9de6ebb69234b` |
| `pet-second-900.png` | `3f479c03749fb023484814b97fc27a846830d55c879d0586e163abf216e1ffb4` |
| `pet-third-0.png` | `ee7cc4126c92fdf2bbabe157887a587431eb8555014f2bffcd636790a172e8f2` |
| `pet-third-450.png` | `66d3ba5e2470b1366c056397bbb462f45c2883d712245b3f3664b1dbedc02315` |
| `pet-third-900.png` | `83b6fe6c598508f7560f81fb621d723384d7d84dd824288042e750f02ae685c0` |
| `sit-0.png` | `3d11868315ef2862cf30eb30186ec81db41daf2dc2a7e7b1bd3c1f72b5a2948c` |
| `sit-450.png` | `91fb4102cad9ea9e41fa9c90e187bda3a0c7ba67ede2ef8ffa10bc9a8f48b3f3` |
| `sit-900.png` | `91fb4102cad9ea9e41fa9c90e187bda3a0c7ba67ede2ef8ffa10bc9a8f48b3f3` |
| `book-open-0.png` | `6a846f747f6abe84de3214355945ad3f0e90cb7c1c71641fd8427efd7a6758f5` |
| `book-open-450.png` | `3e98b0967b9d1a2b621c56d1a3457ba5e26bcc8fe0ec4c21169d46cd293c491a` |
| `book-open-900.png` | `54cf0bbef4a0ca3bef16724404f152b6d39fcc794fbd29dcea8b061f3b7219f1` |
| `lamp-on-0.png` | `eb749eb12a9b4a82a1b5e59e0742d94cb9cd1196abc80d4a2545017378eb9832` |
| `lamp-on-450.png` | `e70eb11ddd5b81a746420e8a7697dab3d8ba242041776c25fa7ead2f1b3475f1` |
| `lamp-on-900.png` | `e70eb11ddd5b81a746420e8a7697dab3d8ba242041776c25fa7ead2f1b3475f1` |
| `lamp-off-0.png` | `29e92b765e40e63230b72ed401d4fd4c934035bb31dfcbf2facd4f7c7f669516` |
| `lamp-off-450.png` | `60aae253148c1f01427c946e95969680e1dc22bb4ee97f886adc34ec387d01de` |
| `lamp-off-900.png` | `60aae253148c1f01427c946e95969680e1dc22bb4ee97f886adc34ec387d01de` |
