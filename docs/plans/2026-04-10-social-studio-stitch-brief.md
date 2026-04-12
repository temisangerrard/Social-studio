# Stitch Brief: Social Studio

Design a clean, canvas-first web app called **Social Studio** for founders and marketers who arrive with a rough content idea and need a polished social package.

## Product intent

This is not a generic dashboard. It is a visual thinking workspace for turning messy fragments into social-ready outputs. The center of the app should feel like a strategy canvas where users can place, stretch, cluster, and rearrange idea cards before generating assets.

## Core UX

- Left rail:
  brand profile selector, board title, raw idea input, notes, platform/goal controls, save board, generate package
- Center:
  large canvas workspace with draggable and resizable cards
- Right rail:
  inspector for the selected card and a generated-results panel

## Card types

Cards should support idea, hook, audience, problem, proof, visual direction, CTA, and notes.

They should feel tactile and editorial, not like default sticky notes. Different card types can have subtle visual distinction without turning the canvas noisy.

## Output panel

The generated package panel should show:

- hook variants
- caption
- hashtags
- platform notes
- vertical slide thumbnails

It should feel like a creative review surface, not a developer console.

## Visual direction

- Clean, premium, warm, and intentional
- Avoid generic SaaS purple gradients
- No dark-mode default
- Use a soft editorial palette with contrast accents
- Typography should feel designed, not default system-only
- Use depth, texture, glass, paper, or subtle layering to make the workspace feel physical
- Make the canvas the hero of the page

## Layout tone

The app should feel like a hybrid of:

- a strategist’s wall
- a creative director’s tabletop
- a modern productivity tool

It should be calm enough for long sessions but strong enough to feel like a product, not an internal prototype.

## Motion

- subtle card hover and lift behaviors
- smooth drag feedback
- gentle panel transitions
- avoid over-animated UI chrome

## Responsive behavior

- desktop-first experience
- rails should collapse intelligently on smaller screens
- canvas should remain usable on laptops and tablets

## Deliverable

Design the main app screen first:

1. left rail for controls
2. center canvas workspace
3. right rail for inspector and generated package

Then provide supporting states for:

- empty canvas
- active card selected
- generation in progress
- results loaded with slide thumbnails
