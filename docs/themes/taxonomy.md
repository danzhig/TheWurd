# Themes: taxonomy

**Status: proposed, awaiting the owner’s approval.** No passages are assigned until it is approved.

10 themes and 43 sub-themes for the constellation view (docs/PLAN.md §16). Titles and descriptions are original prose and never quote scripture. Each sub-theme names the dataset topics its candidate passages will come from (P6.2): `nave:KEY` is a whole entry of Nave’s Topical Bible (public domain), `nave:KEY#n` one row of it, and `openbible:topic` a topic in OpenBible.info’s data (CC BY 4.0). Both datasets are pinned in `sources/manifest.json`.

The counts come from `pnpm themes:taxonomy`: distinct references the sources give (10987 in all, counting a passage once per sub-theme), and where each one’s first verse falls among the built sections. A reference outside any section is one the datasets give in a numbering WEBC does not use; P6.2 lists those for review rather than dropping them. Passages are proposed and approved per theme in P6.2, so these numbers are a ceiling, not a selection.

## God and creation (`creation`)

The one God who makes the world, keeps it in being, and shows himself holy, faithful and glorious.

| Sub-theme                                        | Description                                                                                      | Sources                                       | Passages | On the path | In the library |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------- | -------- | ----------- | -------------- |
| **Creation** (`creation-making`)                 | The making of the heavens, the earth and humankind, and creation's praise of its maker.          | `nave:CREATION`, `openbible:creation`         | 11       | 7           | 4              |
| **The holiness of God** (`creation-holiness`)    | God set apart from all that is not God, and the call to be holy in return.                       | `nave:HOLINESS`, `openbible:holiness`         | 210      | 29          | 181            |
| **God's faithfulness** (`creation-faithfulness`) | A God who keeps his word through every generation.                                               | `nave:FAITHFULNESS`, `openbible:faithfulness` | 39       | 12          | 27             |
| **Glory** (`creation-glory`)                     | The weight and splendour of God's presence, seen in the tent, the temple and the face of Christ. | `nave:GLORY`, `openbible:glory`               | 73       | 14          | 59             |

## Covenant and promise (`covenant`)

The bonds God makes with his people, and the promises that carry the story forward.

| Sub-theme                                     | Description                                                                           | Sources                                                                         | Passages | On the path | In the library |
| --------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- | ----------- | -------------- |
| **Covenants** (`covenant-covenants`)          | God binding himself to Noah, Abraham, Israel and David, and the new covenant to come. | `nave:COVENANT`, `openbible:promises`                                           | 136      | 84          | 52             |
| **The law** (`covenant-law`)                  | The instruction given at Sinai, and how it shapes a people's life.                    | `nave:LAW`, `openbible:law`                                                     | 130      | 75          | 55             |
| **Sabbath and feasts** (`covenant-sabbath`)   | Holy time: the day of rest and the yearly feasts that remember what God has done.     | `nave:SABBATH`, `nave:FEASTS`, `openbible:sabbath`                              | 201      | 123         | 78             |
| **The promised Messiah** (`covenant-messiah`) | The hope of an anointed king, and its fulfilment as the Church reads it.              | `nave:JESUS, THE CHRIST#711`, `nave:JESUS, THE CHRIST#301`, `openbible:messiah` | 107      | 62          | 45             |

## Sin and turning back (`sin`)

How people turn from God, and how they find their way back.

| Sub-theme                                        | Description                                                   | Sources                                                                              | Passages | On the path | In the library |
| ------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- | ----------- | -------------- |
| **Sin** (`sin-sin`)                              | The fall and its spread, and sin named for what it is.        | `nave:SIN`, `openbible:sin`                                                          | 583      | 224         | 359            |
| **Temptation** (`sin-temptation`)                | Trials of desire and loyalty, resisted or given in to.        | `nave:TEMPTATION`, `openbible:temptation`                                            | 175      | 60          | 115            |
| **Idolatry and pride** (`sin-idols`)             | Putting something else in God's place, including oneself.     | `nave:IDOLATRY`, `nave:PRIDE`, `openbible:idolatry`, `openbible:pride`               | 508      | 189         | 319            |
| **Repentance and confession** (`sin-repentance`) | Turning around: owning wrong, asking pardon, beginning again. | `nave:REPENTANCE`, `nave:CONFESSION`, `openbible:repentance`, `openbible:confession` | 299      | 145         | 153            |

## Mercy and forgiveness (`mercy`)

God's mercy to sinners, and the forgiveness people are asked to pass on.

| Sub-theme                                                  | Description                                                                        | Sources                                                                                                        | Passages | On the path | In the library |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- | ----------- | -------------- |
| **Mercy** (`mercy-mercy`)                                  | Compassion that goes beyond what is owed.                                          | `nave:MERCY`, `openbible:mercy`, `openbible:divine mercy`                                                      | 45       | 11          | 34             |
| **Forgiveness** (`mercy-forgiveness`)                      | Sins forgiven by God, and forgiving one another.                                   | `nave:FORGIVENESS`, `openbible:forgiveness`, `openbible:forgiving one another`                                 | 63       | 25          | 38             |
| **Grace** (`mercy-grace`)                                  | A gift that cannot be earned.                                                      | `openbible:grace`                                                                                              | 12       | 1           | 11             |
| **Redemption and reconciliation** (`mercy-reconciliation`) | A people bought back and enemies made friends again, with God and with each other. | `nave:REDEMPTION`, `nave:RECONCILIATION`, `nave:ATONEMENT`, `openbible:redemption`, `openbible:reconciliation` | 184      | 46          | 138            |

## Faith, hope and trust (`faith`)

Holding on to God in the dark, and acting on what he has said.

| Sub-theme                                      | Description                                                 | Sources                                                                        | Passages | On the path | In the library |
| ---------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- | ----------- | -------------- |
| **Faith** (`faith-faith`)                      | Believing God and staking a life on his word.               | `nave:FAITH`, `openbible:faith`                                                | 727      | 231         | 496            |
| **Hope** (`faith-hope`)                        | Looking forward to what God has promised but not yet given. | `nave:HOPE`, `openbible:hope`                                                  | 81       | 13          | 68             |
| **Trust and fear** (`faith-trust`)             | Trusting God when afraid or anxious.                        | `openbible:trust`, `openbible:fear`, `openbible:anxiety`                       | 37       | 4           | 33             |
| **Obedience and patience** (`faith-obedience`) | Faith that listens, waits and keeps going.                  | `nave:OBEDIENCE`, `nave:PATIENCE`, `openbible:obedience`, `openbible:patience` | 361      | 146         | 215            |

## Prayer and worship (`prayer`)

Speaking to God, praising him, and the worship of his people.

| Sub-theme                                               | Description                                                    | Sources                                                                              | Passages | On the path | In the library |
| ------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- | ----------- | -------------- |
| **Prayer** (`prayer-prayer`)                            | Asking, pleading, listening: people at prayer.                 | `nave:PRAYER`, `openbible:prayer`                                                    | 643      | 282         | 360            |
| **Praise and thanksgiving** (`prayer-praise`)           | Song and thanks for who God is and what he has done.           | `nave:PRAISE`, `openbible:praise`, `openbible:thanksgiving`                          | 292      | 38          | 253            |
| **Worship and sacrifice** (`prayer-worship`)            | Altar, tabernacle and temple, and the offering of oneself.     | `nave:WORSHIP`, `openbible:worship`, `openbible:sacrifice`                           | 222      | 86          | 136            |
| **Fasting** (`prayer-fasting`)                          | Going without, to seek God or to mourn.                        | `nave:FASTING`, `openbible:fasting`                                                  | 69       | 41          | 28             |
| **Baptism and the Lord's Supper** (`prayer-sacraments`) | Washing and the shared meal at the heart of the Church's life. | `nave:BAPTISM`, `openbible:baptism`, `openbible:lords supper`, `openbible:eucharist` | 107      | 60          | 47             |

## Suffering and comfort (`suffering`)

Pain, loss and persecution, and God's comfort in them.

| Sub-theme                                     | Description                                  | Sources                                                                                   | Passages | On the path | In the library |
| --------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- | ----------- | -------------- |
| **Suffering** (`suffering-suffering`)         | Affliction borne, questioned and lamented.   | `nave:SUFFERING`, `openbible:suffering`, `openbible:affliction`                           | 86       | 13          | 73             |
| **Grief and death** (`suffering-grief`)       | Mourning the dead and facing death.          | `nave:DEATH`, `nave:MOURNING`, `openbible:grief`, `openbible:death`, `openbible:mourning` | 438      | 193         | 245            |
| **Persecution** (`suffering-persecution`)     | Suffering for faithfulness.                  | `nave:PERSECUTION`, `openbible:persecution`                                               | 286      | 125         | 161            |
| **Healing and comfort** (`suffering-healing`) | The sick restored and the grieving consoled. | `openbible:healing`, `openbible:sickness`, `openbible:comfort`                            | 34       | 8           | 26             |

## Love, family and neighbour (`love`)

Love of God and neighbour, lived out at home and among strangers and the poor.

| Sub-theme                                         | Description                                                       | Sources                                                                                                                                | Passages | On the path | In the library |
| ------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | -------------- |
| **Love** (`love-love`)                            | The love God shows, and the love he commands.                     | `nave:LOVE`, `openbible:love`                                                                                                          | 318      | 82          | 236            |
| **Marriage** (`love-marriage`)                    | Husband and wife, faithfulness and its breaking.                  | `nave:MARRIAGE`, `nave:ADULTERY`, `nave:DIVORCE`, `openbible:marriage`, `openbible:divorce`                                            | 308      | 125         | 183            |
| **Parents and children** (`love-family`)          | Raising children, honouring parents, families blessed and broken. | `nave:CHILDREN`, `nave:PARENTS`, `nave:FAMILY`, `openbible:family`, `openbible:children`, `openbible:parents`                          | 571      | 320         | 251            |
| **Friendship and hospitality** (`love-neighbour`) | Friends, neighbours and the welcome of strangers.                 | `nave:FRIENDSHIP`, `nave:HOSPITALITY`, `nave:NEIGHBOR`, `openbible:friendship`, `openbible:hospitality`, `openbible:neighbor`          | 174      | 88          | 86             |
| **Justice and the poor** (`love-poor`)            | Fair dealing, and care for the poor, the widow and the orphan.    | `nave:JUSTICE`, `nave:POOR`, `nave:WIDOW`, `nave:ORPHAN`, `openbible:justice`, `openbible:poor`, `openbible:widow`, `openbible:orphan` | 359      | 131         | 228            |

## Wisdom and the way of life (`wisdom`)

How to live well before God: wisdom, humility, peace and the right use of things.

| Sub-theme                                        | Description                                                         | Sources                                                                                                      | Passages | On the path | In the library |
| ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- | ----------- | -------------- |
| **Wisdom** (`wisdom-wisdom`)                     | The fear of the Lord and the practical wisdom that follows from it. | `nave:WISDOM`, `openbible:wisdom`                                                                            | 344      | 119         | 225            |
| **Humility** (`wisdom-humility`)                 | Knowing one's place before God and others.                          | `nave:HUMILITY`, `openbible:humility`                                                                        | 168      | 58          | 110            |
| **Peace and joy** (`wisdom-peace`)               | Peace with God and gladness of heart.                               | `nave:PEACE`, `nave:JOY`, `openbible:peace`, `openbible:joy`                                                 | 365      | 92          | 273            |
| **Self-control and contentment** (`wisdom-self`) | Mastery of oneself, and being satisfied with enough.                | `nave:CONTENTMENT`, `nave:SELF-CONTROL`, `openbible:self-control`, `openbible:contentment`                   | 62       | 8           | 54             |
| **Work, money and generosity** (`wisdom-riches`) | Labour, wealth and its dangers, and open-handed giving.             | `nave:RICHES`, `nave:MONEY`, `openbible:work`, `openbible:wealth`, `openbible:money`, `openbible:generosity` | 205      | 86          | 119            |

## The kingdom and the life to come (`kingdom`)

God's reign breaking in, the Spirit and the Church, and the hope of resurrection.

| Sub-theme                                             | Description                                                    | Sources                                                                                                                                           | Passages | On the path | In the library |
| ----------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | -------------- |
| **The kingdom of God** (`kingdom-kingdom`)            | God's rule announced, taught in parables and prayed for.       | `nave:KINGDOM OF HEAVEN`, `openbible:kingdom of god`, `openbible:kingdom of heaven`                                                               | 52       | 18          | 34             |
| **Salvation** (`kingdom-salvation`)                   | Rescue and deliverance, from the sea to the cross.             | `nave:SALVATION`, `openbible:salvation`, `openbible:deliverance`                                                                                  | 309      | 91          | 217            |
| **The Holy Spirit and the Church** (`kingdom-spirit`) | The Spirit given, and the community it gathers.                | `nave:HOLY SPIRIT`, `nave:CHURCH`, `openbible:holy spirit`, `openbible:church`                                                                    | 1154     | 338         | 815            |
| **Resurrection and judgment** (`kingdom-last`)        | The dead raised, the world judged, and life with God for ever. | `nave:RESURRECTION`, `nave:JUDGMENT`, `nave:HEAVEN`, `openbible:resurrection`, `openbible:eternal life`, `openbible:judgment`, `openbible:heaven` | 439      | 126         | 313            |
