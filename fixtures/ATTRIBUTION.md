# Evidence used in the demonstration

Every photograph on the deployment of record is a real photograph of a real
installation, published under a free licence and attributed here. None of it is
anyone's actual contract: the projects are demonstrations written to show how
the record works.

| file | what it shows | author | licence | source |
|---|---|---|---|---|
| `growatt-inverter.jpg` | A Growatt string inverter installed on a wall, front face, with the manufacturer's name legible and the model not | Zátonyi Sándor (ifj.) Fizped | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Growatt_MOD_4000TL3-X_inverter.jpg) |
| `growatt-nameplate.jpg` | The rating plate on the side of the same unit: `Growatt PV Grid Inverter, Model name MOD 4000TL3-X, 4000 W`, with serial and CE marks | Zátonyi Sándor (ifj.) Fizped | CC BY 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Growatt_MOD_4000TL3-X_inverter_data_sheet.jpg) |
| `kostal-inverter.jpg` | A Kostal Piko inverter installed on a wall: a different manufacturer and model, used where the terms specify something the site does not have | Asurnipal | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Dornbirn-Kostal_Inverter-Piko_10.1-02ASD.jpg) |
| `array-kenya.jpg` | An installed photovoltaic array | PowerAfricaSolar | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Solar_Installation_in_Kenya.jpg) |

Each image is redrawn to a JFIF JPEG under 400,000 bytes before it is filed,
because that is what the runner's decoder reads and what the contract accepts.
The contract stores those exact bytes and computes their digest itself, so what
the validators judged can be fetched back from the chain and hashed.

## Why these four

The flagship demonstration turns on one question a schedule can ask and a
photograph can answer: is the inverter on that wall the model the contract
specified?

- The front photograph shows an inverter installed, and the word Growatt. It
  does not show a model number. On its own it establishes that something of
  that role is installed, not that it is the specified one.
- The rating plate photograph reads the model. Together the two establish the
  line.
- The Kostal photograph is the same role and a different product, which is how
  the contradiction case is built from real evidence rather than a story.
- The array photograph carries the module and mounting lines.
