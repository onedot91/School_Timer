from collections import deque
from pathlib import Path

from PIL import Image


SOURCE = Path("tmp/imagegen/emotion-atlas-v2.png")
OUTPUT = Path("public/emotions-v2")
NAMES = [
    ["furious", "irritable", "stressed", "excited", "thrilled", "overwhelmed-with-joy"],
    ["angry", "scared", "anxious", "brave", "amused", "moved"],
    ["dislike", "annoyed", "worried", "proud", "glad", "happy"],
    ["hurt", "envious", "bored", "relieved", "grateful", "loving"],
    ["lonely", "sad", "tired", "calm", "satisfied", "content"],
    ["hopeless", "depressed", "drained", "relaxed", "comfortable", "peaceful"],
]


def connected_components(alpha: Image.Image) -> list[list[tuple[int, int]]]:
    width, height = alpha.size
    pixels = alpha.load()
    seen = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if seen[index] or pixels[x, y] < 24:
                continue

            queue = deque([(x, y)])
            seen[index] = 1
            component: list[tuple[int, int]] = []

            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for next_y in range(max(0, current_y - 1), min(height, current_y + 2)):
                    for next_x in range(max(0, current_x - 1), min(width, current_x + 2)):
                        next_index = next_y * width + next_x
                        if seen[next_index] or pixels[next_x, next_y] < 24:
                            continue
                        seen[next_index] = 1
                        queue.append((next_x, next_y))

            if len(component) >= 4:
                components.append(component)

    return components


def main() -> None:
    atlas = Image.open(SOURCE).convert("RGBA")
    width, height = atlas.size
    cell_width = width / 6
    cell_height = height / 6
    groups: dict[tuple[int, int], list[tuple[int, int]]] = {
        (row, column): [] for row in range(6) for column in range(6)
    }

    for component in connected_components(atlas.getchannel("A")):
        center_x = sum(point[0] for point in component) / len(component)
        center_y = sum(point[1] for point in component) / len(component)
        column = min(5, max(0, round(center_x / cell_width - 0.5)))
        row = min(5, max(0, round(center_y / cell_height - 0.5)))
        groups[(row, column)].extend(component)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for row in range(6):
        for column in range(6):
            points = groups[(row, column)]
            min_x = max(0, min(point[0] for point in points) - 8)
            min_y = max(0, min(point[1] for point in points) - 8)
            max_x = min(width, max(point[0] for point in points) + 9)
            max_y = min(height, max(point[1] for point in points) + 9)
            atlas.crop((min_x, min_y, max_x, max_y)).save(
                OUTPUT / f"{NAMES[row][column]}.png",
                optimize=True,
            )


if __name__ == "__main__":
    main()
