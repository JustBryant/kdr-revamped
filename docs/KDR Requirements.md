Layout for KDR functionality:This will go through and describe in depth, each required use case, and function I want for my different aspects of KDR. In turn, it will provide a viewpoint of how the Database needs to be setup in order to properly accommodate these requirements.

Classes:

Classes are the main idea of KDR. They contain a Unique Skill, Quest, Relic, Tip Skills, Legendary Monster, Starting Items, and Loot Pools, Stats, and XP.

Starting Inventory:

Unique Skill:

The Unique Skill is a Class specific skill. It defines the playstyle of that class. This is simply put, a Skill that a class has by default. It requires the same functionality as any regular skill.

Legendary Quest:

The Legendary Quest, is a Class specific quest. It is what a player must do in order to gain access to their Legendary Relic in a game. Fundamentally, it’s similar to a Skill and should share functionality.

Legendary Relic:

The Legendary Relic, is a Class specific relic. This is made usable ONLY after a player completes their Legendary Quest. Once more, it functions like a Skill and should share functionality.

Legendary Monster:

The Legendary Monster, is simply put, a card that is selected to represent the Class. It’s what the Legendary Quest is designed around. The important parts here, is the ability to choose multiple cards and have more than 1 Legendary Monster, and the ability for the Legendary Monster to potentially change if the class does so in some way.

Starting Items:

Starting Items, are the Cards and Skills a Class begins with in their inventory. These are the ones you immediately have access to while playing. They are just cards, and skills nothing special about them beyond being what they begin with and should each be treated the same as Cards and Skills.

Loot Pools:

Loot Pools in Classes, are the Class specific Loot that can be purchased in the Shop Phase. There are 3 tiers to Class Loot as of right now: Starter Packs, Mid Quality, and High Quality. These pools can contain both Cards and Skills in them. Class Loot Pools are specific to that Class, and can only be obtained by that Class in the Shop. Each Loot Pool needs to reference the Cards and Skills it contains to make it easily translatable for adding to the inventory. These should share functionality with the Generic Loot Pools. 

Tip Skills:

Tip Skills, are Class specific skills that can only be obtained via the Shop Phase by “tipping” the shopkeeper. They are unique in that, you can only get your classes tip skill, and have a random required gold value between two set values. Again, should share functionality with regular Skills.

Stats:

Stats are the different buffs you can increase as a run goes on. You obtain Stat points in your Shop Phase that can be used to level up each of the 5 different Stats. Now, while 5 stats currently exist, each one should be stored as its own item under a greater “Stats” one. This way, it can become effortless to implement new Stats later without requiring a massive rework to many different elements. Stats have a numerical value to them.

XP:

XP is the method of gaining Levels in KDR. You gain XP as you play Rounds, or by Training. Gaining a level grants a Skill choice and a Stat Point, and what Loot you can purchase is locked behind your Level as well. XP is a numerical value.

Gold:

Gold is used for purchasing Training or Loot Pools, as well as Tipping. The amount of Gold a class starts with is typically 0, but this should be modifiable. Gold has a unique mechanic as well – Interest. Interest is where a player gains additional gold at the End of a Shop Phase, based on how much they have left. Both these values need to be modifiable in the settings.

Overall:

Classes have a lot of components to them, that all needs to be created cleanly and have well thought out, easy to use DB storing. The Inventory specifically, needs to easily be able to accept new cards and skills into it, which is a large reason for this redesign.

Shop:

The Shop is the big part of KDR. This is where your run is shaped. It has several different stages, as well as different unique aspects to it. I’ll break them down fully into two sections.

Shop Stages:

The Shop has a flow to it, an order in which these phases take place. I will do my best to layout each one in order. 

Start Phase:

This is the beginning. This takes place when the user first starts their Shop. At this step, the user is granted the amount of Gold and XP specified in the settings.

Check Phase:

The Check Phase is a reusable phase. This phase has to check how much XP the user has and compare if it causes them to increase in Level. If yes, it checks in the settings if this Level offers a Skill Choice. The player is granted the number of Stat Points decided in the settings, and it moves onto the “Skill Choice” phase if the level the player is currently at DOES offer a Skill Choice. If the Level does not, and  the user has Stat Points, they move onto the Stat Level Phase. If no Level is gained, and the user has no Stat Points it moves onto the Training Phase.

Skill Choice Phase:

This Phase is where the player is offered a choice of Skills (number is decided in the settings). They are required to choose one of the presented Skills, which is then added to that player’s Inventory. After this, if the player has any Stat Points it moves onto the Stat Level Phase. If not, it moves onto the Training Phase.

Stat Level Phase:

This phase is where the player uses their Stat Points in order to increase the value of their Stats. They must use all their Stat Points before continuing to the next phase. Once they use their Stat Points, they go to the Training Phase.

Training Phase:

This phase is where the player can choose to purchase Training for an amount of gold specified in the settings. If yes, it takes the amount of Gold from them, and grants them the XP amount specified in the settings. This then performs a Check Phase. If no, then the user moves onto the Treasures Phase.

Treasures Phase:

This phase is where the user is displayed a choice of Treasures (amount specified in settings). They are chosen at random using the settings to determine the weight of the rarities. It does not display duplicates. The player must choose one, which is added to their inventory, before moving onto the “Loot Phase”.

Loot Phase:

This is the most in depth phase, where the player can purchase all their Class Loot, and Generic Loot. It’s also where the player is able to Sell their Treasures and Skills for gold. This phase will continue until the player clicks the “Finished” button. At which point, it moves onto the “Tip Phase”.

Tip Phase:

This phase is where the player can Tip the Shopkeeper an amount of gold. The amount tipped persists across all Shop Phases they do in this KDR. If the total amount Tipped reaches the number required for the classes “Tip Skills”, then they are displayed as a choice, allowing the player to choose one to add to their inventory. Once one has been chosen, or the player has tipped, the Shop Phase is finished.

Shop Aspects:

Training:

Training is specific to the Shop. It is an amount of gold the user spends in order to gain an amount of XP. Both of these values are modular, and first decided in the settings.

Loot Pools:

While these exist within the Classes or Generic, they function within the Shop. And how they function is important. There are two key markings for a Loot Pool within a shop: Seen, and Purchased. Seen Loot Pools, are pools that you have been shown within any of your Shops, but did not buy. Purchased Loot Pools are specifically the pools you have bought and own. These are important to track to be used in different modals we set up later.

Shopkeepers:

These are the options for the Character that will take you through a Shop. Shopkeepers have a lot of their own designs I’ll get into later, but they are utilised in the Shop.

Overall:

The Shop has a lot of moving pieces, but quite a simple flow to it. It really just needs to make use of the new DB we setup for storing different aspects, and implement them properly.

Generics:

Generics are the things not restricted to any one Class. This includes Generic Loot, Skills, and the Treasures.

Generic Loot:

This is loot that can be purchased by every class. It’s setup independently of Class Loot, but shares the functionality with it. It can contain both Cards and Skills, have tax on it (increasing the amount cost by the tax value when in the Shop.), and be affected by other factors. It needs to be created clearly referencing the Cards and Skills it has, as separate entities (arrays?) so they can easily be processed. There are three types of Generic Loot: Staples, Removal/Disruption, and Engine.

Generic Skills:

Skills that are accessible to every class. These are the Skills that are displayed in the “Skill Choice Phase” of the Shop. They have the option for descriptions, the ability to have modifiers on cards, and a True/False for if they are able to be sold.

Treasures:

Treasures are unique cards, that are obtained at 1 copy at a time. They are chosen in the Shop during the “Treasures Phase” and added to a player inventory. Unlike other cards, Treasures also come attached with a “Rarity”. These Rarities indicate how rare the Treasure is and how likely it is to appear. The rarities are Normal, Rare, Super Rare, and Ultra Rare. These can be shortened to “N”, “R”, “SR”, and “UR”. 

Formats:

The formats are what makes up a full KDR experience. It contains the Classes, Skills, Loot, Treasures, and Settings.  It can also have different effects or modifiers to it. There’s a lot that goes into a format.

Classes/Generic Skills/Generic Loot/Treasures (Format View):

These all function the same throughout KDR formats. They have the same logic applied, they simply exist under a specific Format itself.

Settings:

The settings for a format are basically the logic behind different aspects of KDR. They dictate the different values. There are many parts to the Settings so let’s go through them all.

Levelling System:

This is where the different XP values for Levels are setup. Configuring the amount of XP (Integer) required per Level. It needs to allow for any number of Levels to be added or removed.

Skill System:

This system stores the amount of Generic Skills randomly displayed to the player in the “Skill Choice Phase”. It’s a simple integer again. Additionally, it requires a check for “All Levels Grant Skill Choice”. If this is true, then it will always display a Skill Choice when the player levels in the shop. If this is false, then it needs to use the “Skill Unlock Levels” to display a Skill to the user only at the specified levels stored.

Round Rewards:

This is the amount of XP and amount of Gold given to a Player when they are in the Shop Start Phase.

Shop Configuration:

This has a lot more to it so I’ll break it down individually.

Loot Pools:

This is where the different values for all the existing Loot Pools categories are setup. It has 3 values per Loot Pool category – Count, which is the number of that category displayed in the Shop Phase. Cost, which is how much gold it costs to purchase that category. Min Lvl, which is the minimum Level the player must be for that category to be displayed to them. This is for both the Class specific and Generic Categories.

Training:

This is where the Training values are setup. It includes the Training Cost (how much gold it costs to purchase a training session), and the Training XP Gain (how much XP is granted from a single training session).

Treasures:

This is where the weights for the different Treasure Rarities are setup. It uses these weights to decide which rarity is being chosen per Treasure offered. There is also a setting here for amount of Treasures offered.

Modifiers:

Modifiers are something that drastically affects a KDR format. It can change how the Shop is organised, introduce unique phases, or even completely randomise what is available to people. Modifiers essentially have no limit, but must be coded in. This will simply store any chosen modifiers to be used so they are enabled for that format.

Public:

This is a simple true/false option. It basically decides if this Format is publicly accessible, and let’s any user host it. If false, then it can only be accessed by admins, and only they can Host KDR’s like it.

Overall:

For the Settings, its important to keep note these are the base, default settings that the format uses. Individual KDR’s will be modular, allowing for these values to be changed in that specific KDR. But having the baseline well designed and easily usable will make having these modular KDR’s simpler.

Overall:

The Formats are important to get right, as these values are heavily used. Them being easy to obtain and read is essential to a smooth dev experience.

KDR:

Now, let’s focus on the actual running of a KDR. This includes the creation, player management, inventories, score handling, bracket creation, a whole lot.

KDR Creation:

This section is for the aspects that go into creating/hosting a KDR tournament.

Basic Setup:

The basic setup for a KDR, includes the Name (which is input by the user) that is used and displayed on site. This is a simple String, that makes it easy to find a specific KDR you wish to join. It also includes a Player Count, which is the number of users allowed to join the tournament. What is also included, is the “Format” where the Host selects which Format they wish this KDR to be in.  This is used for grabbing anything in that format to be used for this KDR. An Admin specific setting, is a Ranked choice. This is a True/False option, where if the KDR is hosted as Ranked, it will affect the Ranked Elo of the players. Only admins are able to create Ranked KDR’s, every other will be unranked by default.

Unique ID’s:

To avoid issues with KDR’s having the same name, a unique ID must be generated and applied to each upon creation. This is the identifier that is used on the backend to refer to this specific KDR, and prevent any data leaking from others.

More Settings:

Settings that allow the host to have near total control over the KDR tournament they create. Everything can be altered here. These settings are all saved within this unique KDR and used throughout to avoid and issues on a Format update mid-tournament.

Classes:

The host can disable specific classes from being usable in this KDR. They can also change how many Class choices are displayed to the user, if duplicate classes are allowed, and if users can simply choose any class they want.

Skills:

The host can disable specific Generic Skills from being displayed in the Shop for this KDR.

Gold Gain:

The host can alter the amount of Gold gained in the Shop Start Phase, as well as the values for Interest.

XP/Training/Levels:

The host can alter the amount of XP gained in the Shop Start Phase, and by training. They can alter at what XP values you gain a Level, if a Skill choice is given on every level or specify certain levels to grant one.

Loot:

The host can alter the count, cost, and Min Level of each Loot Category.

Treasures:

The host can alter the Treasures rarity weights, and how many treasures are offered.

Bracket Type:

This is a simple two choice option for now. It let’s the host decide if the KDR is played as a Round Robin (default) or Swiss tournament. Both of these have their own unique settings too. In the future, more options could be added so keep that in mind when creating.

Round Robin:

The host can choose how many times each player faces against each other (default 1).

Swiss:

The host can choose how many Rounds of Swiss will be played. They can choose to leave it, and the number will automatically be set to the appropriate amount based on the number of players that entered.

Password:

A password that has to be entered to join the KDR. Good for privately hosted tournaments.

Modifiers:

Allows the host to choose any existing Modifiers to apply to the KDR. Multiple can be chosen.

Round Length:

Specifies how long each Round lasts. Is the length of time users have to play and report their match results on site.

KDR Hosting:

This is after a KDR has been created. The tournament is hosted, and players are able to join it.

Players:

Needs to store which players are currently set as having joined the KDR. Should use the players user id (username) to keep track of that information. Must update appropriately if a player leaves or is kicked for any reason.

Delete KDR:

The host is able to Delete the KDR tournament at any point.

Start State:

Stores if the KDR has been started or not. This will impact what is able to be done including choosing classes, creating the round brackets, playing matches, etc. Before the KDR has been started, the only action that can be taken by players is Joining or Leaving the tournament. The host must start the KDR before any more can be done.

Class Picking:

Uses the settings for this tournament to let a player pick their class. This will either be a choice selection at random or from a list of any class based on the settings. Once a player has chosen their Class it is locked in. That is the class they are for this KDR.

Bracket Generating:

The host can generate brackets for the round after a KDR has started. This will display the matches for the round so users can see them. It will also allow for users to report their results for that match.

Next Round:

A simple button the host can click which will move the event onto the next round. This will generate a new bracket for this round displaying them to the players.

Class Pages:

Each player in the KDR will have their own Class Page. This is their Inventory. It contains all the things we listed out earlier, specific to this KDR.

Rounds:

This is the tracker for what round of the KDR it is. Each round can have 1 bracket, and 1 Shop per player.

Shop:

A shop is available to a player after their match result has been reported. In this instance, the important to check thing is if the Player has finished their Shop for the round. This is something to keep track of so it can be used for visual displays.

Scores:

This is keeping track of each player’s scores. What matters is tracking the number of Wins they have, their points scored (this is game wins, so losing a match 1-2 would still grant 1 point scored), their point difference (amount of games won – amount of games lost), wins vs tied opponents (how many match wins against opponents with the same placement). This will be used to determine the ranking at the end of the KDR. 

Overall:

This is much more user focused, and is a lot of checking data values but an essential aspect to have correct and easy to use.

User Stats:

These are user specific stats that are stored within the actual user on site. Often used for display purposes, but its a lot to track and needs to be properly setup.

General Stats:

These are the overall stats essentially, that displays all the information combined as opposed to displaying stats related to individual classes.

Elo:

The Elo the player has. Calculated using the Elo system.

Win/Loss Ratio:

A simple W/L Ratio, storing how many times the user has Won or Lost a match. 

Most Beaten Player:

This is the user that this user has beaten the most times in KDR. What this means, is we need to track how many times a player has faced off against each user they play, and how many match wins and losses they have against them. We should only track users they have actually played against.

Most Lost To Player:

This is just the opposite of the “Most Beaten Player”, displaying the user that has beaten this user the most.

Most Picked Card:

This is the individual card this user has picked the most times. This means we need to track, whenever a player obtains a card(s) and track how many times they’ve obtained that card.

Favourite Class:

This is the Class the user has picked the most times. We just track how many times they have chosen each class.

Favourite Skill:

This is the Skill they have picked the most times. We just track how many times they have chosen each skill.

Best Match-up:

Shows the class they have beaten most.

Worst Match-up:

Shows the class they have lost to the most.

Game Losses Granted:

This is a different one. This stat shows how many times a host has given this user a game loss for any reason.

Class Stats:

These are the stats individual to each class. Many will be similar or identical to the General Stats but only count for when the user was playing each specific class.

Win/Loss Ratio:

A simple W/L ratio, showing how many wins and losses the user has had on a class.

Picks:

Displays how many times the user has picked this class to play.

Favourite Card:

Shows the card they picked most while playing this class.

Best Match-up:

Shows the class they have beaten most while playing this class.

Worst Match-up:

Shows the class they have lost to the most while playing this class.

Overall:

Lots of data to store and keep organised but its a neat utility to have for users to check.

Others:

These are the things I wanted to talk about in more detail. One’s that I felt need to be done truly correctly.

Skills:

Skills have several important considerations and features we need.

Description:

The simplest part. The description of a Skill is a simple string that is written for it.

Card Modifiers:

These are specific modifications a Skill can make to any cards. It can either negate an effect, alter the effect, or add a condition to it.

Stat Modifiers:

Some Skills alter their own effect if the user has a certain amount of points in a Stat. 